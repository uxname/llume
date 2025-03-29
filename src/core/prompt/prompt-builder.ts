import { EXECUTE_AI_FUNCTION_TEMPLATE } from "./templates/execute-function-prompt.ts";
import { History } from "../history.ts";
import { z } from "zod";
import type { AiFunction, FunctionVariables } from "../ai-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "../tool.ts";
import { BaseSuccessSchema, CallToolSchema, ErrorSchema } from "./schemas.ts";
import type { ExecutionContext } from "../execution-context.ts";

type ExecuteFunctionPromptParams = {
  history: string;
  jsonSchemas: string;
  query: string;
  tools: string;
  state: string;
};

export class PromptBuilder {
  public static mergeSystemSchemas(aiFunction: AiFunction): string {
    const SuccessSchemaWithData = BaseSuccessSchema.extend({
      _data: aiFunction.outputSchema,
    });

    const systemSchemas = z.discriminatedUnion("_type", [
      SuccessSchemaWithData,
      ErrorSchema,
      CallToolSchema,
    ]);

    // Используем ZodToJsonSchema с опциями для лучшего описания
    const jsonSchema = zodToJsonSchema(systemSchemas, {
      $refStrategy: "none", // Избегаем $ref для совместимости с некоторыми LLM
      definitionPath: "schemas", // Добавляем префикс
    });

    return JSON.stringify(jsonSchema);
  }

  public static buildExecuteFunctionPrompt(
    context: ExecutionContext,
    aiFunction: AiFunction,
    variables: FunctionVariables,
    tools: Tool[],
  ): string {
    const schemasString = this.mergeSystemSchemas(aiFunction);
    const limitedHistoryString =
      context.executionHistory.getLimitedMessagesAsString(context.historyLimit);
    const stateString = JSON.stringify(context.state);

    const userQueryRendered = aiFunction.promptTemplate.render(variables);

    const promptParams: ExecuteFunctionPromptParams = {
      history: limitedHistoryString,
      jsonSchemas: schemasString,
      query: userQueryRendered,
      tools: tools.map((tool) => tool.toString()).join("\n\n"),
      state: stateString,
    };

    const result =
      EXECUTE_AI_FUNCTION_TEMPLATE.render<ExecuteFunctionPromptParams>(
        promptParams,
      );

    return result.trim();
  }
}
