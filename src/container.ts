import type { AiExecutionEngineBase } from "./ai-execution-engine/ai-execution-engine-base.ts";
import {
  AiFunction,
  type MicroAgentResponse,
  type TemplateVars,
} from "./ai-function-base/ai-function.ts";
import { Prompt } from "./prompt/prompt.ts";
import { zodToJsonSchema } from "zod-to-json-schema";

export class Container {
  private aiFunctions: Map<string, AiFunction> = new Map();
  private executionEngine: AiExecutionEngineBase;
  private rules: Prompt[] = [];

  constructor(executionEngine: AiExecutionEngineBase) {
    this.executionEngine = executionEngine;
  }

  addRule(rule: string) {
    this.rules.push(new Prompt(rule));
  }

  registerAiFunction(aiFunction: AiFunction) {
    aiFunction.container = this;
    this.aiFunctions.set(aiFunction.name, aiFunction);
  }

  async executeAiFunction(
    aiFunctionName: string,
    vars: TemplateVars,
  ): Promise<MicroAgentResponse> {
    const aiFunction = this.aiFunctions.get(aiFunctionName);
    if (!aiFunction) {
      throw new Error(`AI function "${aiFunctionName}" not found`);
    }

    aiFunction.validateVars(vars);
    const prompt = aiFunction.getPrompt().merge(this.rules);
    const renderedPrompt = prompt.render({
      ...vars,
      schema: JSON.stringify(zodToJsonSchema(aiFunction.responseSchema)),
    });

    let lastError: Error | null = null;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.executionEngine.execute({
          prompt: renderedPrompt,
        });

        const parsedResponse = aiFunction.parseResponse(response);

        if (parsedResponse._error) {
          throw new Error(parsedResponse._error?.message);
        }

        return parsedResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `Attempt ${attempt} failed for "${aiFunctionName}": ${lastError.message}`,
        );
        if (attempt === MAX_ATTEMPTS) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Unknown error after retries");
  }
}
