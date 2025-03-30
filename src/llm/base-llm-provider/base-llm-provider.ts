import { LlmHelper } from "../llm-helper/llm-helper.ts";

export abstract class BaseLlmProvider {
  public abstract readonly name: string;

  public abstract executeRaw(prompt: string): Promise<string>;

  public preparePrompt(prompt: string): string {
    return prompt;
  }

  public finalizeResponse(response: string): string {
    return response;
  }

  public async execute(prompt: string): Promise<string> {
    const preparedPrompt = this.preparePrompt(prompt);

    const rawResponse = await this.executeRaw(preparedPrompt);

    const sanitizedResponse = LlmHelper.sanitizeLLMJsonResponse(rawResponse);

    return this.finalizeResponse(sanitizedResponse);
  }
}
