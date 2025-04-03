import type { BaseLlmProvider } from "../llm/base-llm-provider/base-llm-provider";
import { LlmRequestCompiler } from "../llm-request/llm-request-compiler/llm-request-compiler";
import {
  type CallToolResponse,
  type ErrorResponse,
  type LlmResponse,
  LLMResponseTypes,
  type SuccessResponse,
} from "../llm-response/types";
import { type Pipeline, RequestTarget } from "./pipeline";

export class Executor {
  constructor(public readonly llm: BaseLlmProvider) {}

  async execute<TData>(pipeline: Pipeline): Promise<TData> {
    if (pipeline.executions.length > 0) {
      const lastExecution = pipeline.executions[pipeline.executions.length - 1];

      if (lastExecution.requestTarget === RequestTarget.TOOL) {
        pipeline.llmRequest.toolsCallHistory?.push({
          toolName: lastExecution.toolName!,
          toolInput: lastExecution.input,
          toolOutput: lastExecution.response,
        });
      } else if (lastExecution.requestTarget === RequestTarget.LLM) {
        // If the last request was to LLM, then the pipeline is not in the expected state
        throw new Error(
          "Pipeline is broken: Last execution was LLM, expected TOOL",
        );
      }
    }

    const prompt = LlmRequestCompiler.compile(pipeline.llmRequest);
    const rawResponse = await this.llm.execute(prompt);
    let response: LlmResponse<TData>;

    try {
      response = JSON.parse(rawResponse);
    } catch (_error) {
      const error = _error as Error;
      throw new Error(
        `Failed to parse LLM response: ${error.message}. Request: "${prompt}". Raw response: "${rawResponse}"`,
      );
    }

    pipeline.addExecution(
      RequestTarget.LLM,
      pipeline.llmRequest.query,
      response,
    );

    switch (response.type) {
      case LLMResponseTypes.ERROR: {
        const result = response as ErrorResponse;
        throw new Error(result.message);
      }
      case LLMResponseTypes.SUCCESS: {
        const result = response as SuccessResponse<TData>;
        return result.data;
      }
      case LLMResponseTypes.CALL_TOOL: {
        const result = response as CallToolResponse<unknown>;
        const tool = pipeline.llmRequest.tools?.find(
          (tool) => tool.name === result.tool_name,
        );

        if (!tool) {
          throw new Error(`Tool ${result.tool_name} not found`);
        }

        const toolResult = await tool.execute(result.tool_input);

        pipeline.addExecution(
          RequestTarget.TOOL,
          result.tool_input,
          toolResult,
          result.tool_name,
        );

        return await this.execute(pipeline);
      }
      default:
        throw new Error(`Unknown response type: ${response.type}`);
    }
  }
}
