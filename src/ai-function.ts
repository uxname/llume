import { LlmRequest, type LlmRequestParams } from "./llm-request/llm-request";
import type { BaseLlmProvider } from "./llm/base-llm-provider/base-llm-provider";
import { z } from "zod";
import { Pipeline } from "./executor/pipeline";
import { Executor } from "./executor/executor";

type Variables = Record<string, string>;

interface AiFunctionParams {
  query: string;
  successResponseSchema: z.ZodType;
  llmProvider: BaseLlmProvider;
}

export abstract class AiFunction {
  protected abstract readonly requestParams: Omit<
    LlmRequestParams,
    "variables"
  >;
  protected abstract readonly llmProvider: BaseLlmProvider;

  async execute<T = z.infer<typeof this.requestParams.successResponseSchema>>(
    variables: Variables = {},
  ): Promise<T> {
    const request = new LlmRequest({
      ...this.requestParams,
      variables,
    });

    const pipeline = new Pipeline(request);
    const executor = new Executor(this.llmProvider);

    return executor.execute<T>(pipeline);
  }

  static create(data: AiFunctionParams): AiFunction {
    return new (class extends AiFunction {
      protected readonly requestParams = data;
      protected readonly llmProvider = data.llmProvider;
    })();
  }
}
