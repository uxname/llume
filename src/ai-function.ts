import { LlmRequest, type LlmRequestParams } from "./llm-request/llm-request";
import type { BaseLlmProvider } from "./llm/base-llm-provider/base-llm-provider";
import { z } from "zod";
import { Pipeline } from "./executor/pipeline";
import { Executor } from "./executor/executor";

export abstract class AiFunction {
  abstract readonly requestParams: LlmRequestParams;
  abstract readonly llmProvider: BaseLlmProvider;

  async execute<
    T = z.infer<typeof this.requestParams.successResponseSchema>,
  >(): Promise<T> {
    const request = new LlmRequest(this.requestParams);
    const executor = new Executor(this.llmProvider);
    const pipeline = new Pipeline(request);
    return await executor.execute<
      z.infer<typeof this.requestParams.successResponseSchema>
    >(pipeline);
  }
}
