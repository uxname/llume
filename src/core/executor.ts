/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExecutionContext } from "./execution-context.ts";
import type { Variables } from "./core/stateless-function.ts";
import { PromptBuilder } from "./core/prompt/prompt-builder.ts";
import type {
  BaseSuccessType,
  CallToolType,
  ErrorType,
  LLMResult,
} from "./core/prompt/schemas.ts";

export class Executor extends ExecutionContext {
  async executeSingleFunction<
    TInput extends Variables,
    TOutput extends Variables,
  >(
    functionName: string,
    input: TInput,
  ): Promise<LLMResult<unknown | TOutput>> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`Function ${functionName} not found`);
    }

    const prompt = PromptBuilder.buildExecuteFunctionPrompt(
      this.llmHistory,
      aiFunction,
      input,
      aiFunction.tools ?? [],
    );

    const response = await aiFunction.llm.execute(prompt);

    return JSON.parse(response);
  }

  async callTool<TInput extends Variables, TOutput extends Variables>(
    functionName: string,
    toolName: string,
    input: TInput,
  ): Promise<TOutput> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`Function ${functionName} not found`);
    }

    const tool = aiFunction.tools?.find((tool) => tool.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const result = await tool.execute(input);

    return result as TOutput;
  }

  async smartExecute<TInput extends Variables, TOutput extends Variables>(
    functionName: string,
    input: TInput,
  ): Promise<TOutput> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`Function ${functionName} not found`);
    }

    await aiFunction.preRunMiddleware(input);

    const isFirstRun = this.llmHistory.messages.length === 0;

    if (isFirstRun) {
      this.addHistoryMessage({
        role: "user",
        content: aiFunction.promptTemplate.render<TInput>(input),
      });
    }

    const result = await this.executeSingleFunction(functionName, input);

    this.addHistoryMessage({
      role: "assistant",
      content: result,
    });

    await aiFunction.postRunMiddleware(result);

    if (result._type === "error") {
      throw new Error(result._message);
    }

    if (result._type === "success") {
      return result._data as TOutput;
    }

    if (result._type === "call_tool") {
      const toolResult = await this.callTool(
        functionName,
        result._toolName,
        result._input,
      );

      this.addHistoryMessage({
        role: "user",
        toolResponse: {
          toolName: result._toolName,
          toolResponse: toolResult,
        },
      });

      return await this.smartExecute(functionName, input);
    }

    throw new Error("Unknown result type");
  }
}
