import type { AiExecutionEngineBase } from "./ai-execution-engine/ai-execution-engine-base.ts";
import {
  AiFunction,
  type MicroAgentResponse,
  type TemplateVars,
} from "./ai-function-base/ai-function.ts";
import { Prompt } from "./prompt/prompt.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import { type ToolBase } from "./tool-base/tool-base.ts";
import { z } from "zod";

export const callToolSchema = z.object({
  _action: z.literal("call_tool").describe("Signal to call a tool"),
  _toolName: z.string().describe("Tool name"),
  _toolInput: z
    .unknown()
    .describe(
      "This field should exactly accord to the input schema of the tool",
    ),
});

export class Container {
  private aiFunctions: Map<string, AiFunction> = new Map();
  private executionEngine: AiExecutionEngineBase;
  private rules: Prompt[] = [];
  private tools: Map<string, ToolBase<unknown, unknown>> = new Map();

  constructor(executionEngine: AiExecutionEngineBase) {
    this.executionEngine = executionEngine;
  }

  addRule(rule: string) {
    this.rules.push(new Prompt(rule));
  }

  addTool(tool: ToolBase<unknown, unknown>) {
    this.tools.set(tool.getMetadata().name, tool);
    console.log("Tool added:", this.tools);
  }

  registerAiFunction(aiFunction: AiFunction) {
    aiFunction.container = this;
    this.aiFunctions.set(aiFunction.name, aiFunction);
  }

  public getToolsPrompt(): Prompt {
    if (this.tools.size === 0) {
      return new Prompt("");
    }

    const callToolSchemaString = JSON.stringify(
      zodToJsonSchema(callToolSchema),
    );
    const toolsString = Array.from(this.tools.values())
      .map((tool) => tool.toString())
      .join("\n");

    return new Prompt(
      `You have access to the following tools:
${toolsString}
If you need to use a tool, just send the JSON that should accord to the following JSON schema
(input field should exactly accord to the input schema of the tool):
${callToolSchemaString}
`,
    );
  }

  public getToolResponsePrompt(
    toolName: string,
    toolExecutionResult: string,
  ): Prompt {
    return new Prompt(`The tool ${toolName} returned the following result:
${toolExecutionResult}`);
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
    let prompt = aiFunction.getPrompt().merge(this.rules);
    prompt = prompt.merge(this.getToolsPrompt());
    const renderedPrompt = prompt.render({
      ...vars,
      schema: JSON.stringify(zodToJsonSchema(aiFunction.responseSchema)),
    });

    return await this.retry(async () => {
      const response = await this.executionEngine.execute({
        prompt: renderedPrompt,
      });

      const parsedResponse = aiFunction.parseResponse(response);
      if (parsedResponse._error) {
        throw new Error(parsedResponse._error?.message);
      }

      // Проверка на вызов инструмента
      if (parsedResponse._action === "call_tool" && parsedResponse._toolName) {
        const tool = this.tools.get(parsedResponse._toolName);
        if (!tool) {
          throw new Error(`Tool "${parsedResponse._toolName}" not found`);
        }

        // Выполнение инструмента
        const toolResult = await tool.execute(parsedResponse._toolInput);

        // Формирование нового промпта с результатом инструмента
        const toolResponsePrompt = this.getToolResponsePrompt(
          parsedResponse._toolName,
          JSON.stringify(toolResult),
        );
        const updatedPrompt = prompt.merge(toolResponsePrompt).render({
          ...vars,
          schema: JSON.stringify(zodToJsonSchema(aiFunction.responseSchema)),
        });

        // Повторный вызов AI с результатами инструмента
        const newResponse = await this.executionEngine.execute({
          prompt: updatedPrompt,
        });
        return aiFunction.parseResponse(newResponse);
      }

      aiFunction.validateResponse(parsedResponse);

      return parsedResponse;
    });
  }

  private async retry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    baseDelay = 500,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw error;
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed, retrying in ${delay} ms.`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Could not execute operation after multiple attempts");
  }
}
