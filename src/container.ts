import type { AiExecutionEngineBase } from "./ai-execution-engine/ai-execution-engine-base.ts";
import type { MicroAgentResponse } from "./ai-function-base/ai-function.ts";

export class Container {
  private aiFunctions: Map<string, AiFunction> = new Map();
  private executionEngine: AiExecutionEngineBase;

  constructor(executionEngine: AiExecutionEngineBase) {
    this.executionEngine = executionEngine;
  }

  addAiFunction(aiFunction: AiFunction) {
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
    const prompt = aiFunction.render(vars);
    console.log(prompt);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const response = await this.executionEngine.execute({ prompt });
        const parsedResponse = aiFunction.parseResponse(response);

        if (parsedResponse._error) {
          throw new Error(parsedResponse._error?.message);
        }

        return parsedResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Attempt ${attempt} failed for "${aiFunctionName}": ${lastError.message}`,
        );
        if (attempt === 5) {
          throw lastError;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw lastError || new Error("Unknown error after retries");
  }
}
