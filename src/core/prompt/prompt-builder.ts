import { EXECUTE_FUNCTION_PROMPT_TEMPLATE } from "./templates/execute-function.ts";
import { History } from "../history.ts";
import { z } from "zod";
import type { AiFunction, Variables } from "../ai-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "../tool.ts";
import { BaseSuccessSchema, CallToolSchema, ErrorSchema } from "./schemas.ts";

type ExecuteFunctionPromptParams = {
  history: string; // Теперь это будет строка с ограниченной историей
  jsonSchemas: string;
  query: string;
  tools: string;
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
    history: History,
    aiFunction: AiFunction,
    variables: Variables,
    tools: Tool[],
    historyLimit: number,
  ): string {
    const schemasString = this.mergeSystemSchemas(aiFunction);
    const limitedHistoryString =
      history.getLimitedMessagesAsString(historyLimit);

    const userQueryRendered = aiFunction.promptTemplate.render(variables);

    const promptParams: ExecuteFunctionPromptParams = {
      history: limitedHistoryString,
      jsonSchemas: schemasString,
      query: userQueryRendered,
      tools: tools.map((tool) => tool.toString()).join("\n\n"),
    };

    const result =
      EXECUTE_FUNCTION_PROMPT_TEMPLATE.render<ExecuteFunctionPromptParams>(
        promptParams,
      );

    return result.trim();
  }
}
