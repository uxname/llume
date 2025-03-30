import type { BaseLlmProvider } from "../llm/base-llm-provider/base-llm-provider.ts";
import { LlmRequestCompiler } from "../llm-request/llm-request-compiler/llm-request-compiler.ts";
import {
  type CallToolResponse,
  type ErrorResponse,
  type LlmResponse,
  LLMResponseTypes,
  type SuccessResponse,
} from "../llm-response/types.ts";
import { type Pipeline, RequestTarget } from "./pipeline.ts";

export class Executor {
  constructor(public readonly llm: BaseLlmProvider) {}

  // нужно сделать чтобы вызов происходил на основе того что лежит в pipeline,
  // если там пусто - значит это первй запрос, если там в истории есть что последний был
  // вызов tool - значит нужно сделать вызов llm с результом tool
  async execute<TData>(pipeline: Pipeline): Promise<TData> {
    if (pipeline.executions.length === 0) {
      const prompt = LlmRequestCompiler.compile(pipeline.llmRequest);
      const rawResponse = await this.llm.execute(prompt);
      const response: LlmResponse<TData> = JSON.parse(rawResponse);

      pipeline.addExecution(
        RequestTarget.LLM,
        pipeline.llmRequest.userQuery,
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
          // call tool and rerun
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

    const lastExecution = pipeline.executions[pipeline.executions.length - 1];

    if (lastExecution.requestTarget === RequestTarget.TOOL) {
      // нужно поместить результат выполнения tool в историю и сделать вызов llm
      pipeline.llmRequest.toolsCallHistory?.push({
        toolName: lastExecution.toolName!,
        toolInput: lastExecution.input,
        toolOutput: lastExecution.response,
      });

      const prompt = LlmRequestCompiler.compile(pipeline.llmRequest);
      const rawResponse = await this.llm.execute(prompt);
      const response: LlmResponse<TData> = JSON.parse(rawResponse);

      pipeline.addExecution(
        RequestTarget.LLM,
        pipeline.llmRequest.userQuery,
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
    } else {
      throw new Error("Pipeline is broken");
    }
  }
}
