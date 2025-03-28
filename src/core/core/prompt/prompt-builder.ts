import { EXECUTE_FUNCTION_PROMPT_TEMPLATE } from "./prompts/execute-function.ts";
import { History } from "../history.ts";
import { z } from "zod";
import type { StatelessFunction, Variables } from "../stateless-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "../tool.ts";
import {
  BaseSuccessSchema,
  CallToolSchema,
  ErrorSchema,
  StateCommandSchema,
} from "./schemas.ts";

type ExecuteFunctionPromptParams = {
  history: string;
  jsonSchemas: string;
  query: string;
  tools: string;
};

export class PromptBuilder {
  public static mergeSystemSchemas(aiFunction: StatelessFunction): string {
    const SuccessSchemaWithData = BaseSuccessSchema.extend({
      _data: aiFunction.outputSchema,
    });

    const systemSchemas = z.discriminatedUnion("_type", [
      SuccessSchemaWithData,
      ErrorSchema,
      CallToolSchema,
      StateCommandSchema,
    ]);

    return JSON.stringify(zodToJsonSchema(systemSchemas));
  }

  public static buildExecuteFunctionPrompt(
    history: History,
    aiFunction: StatelessFunction,
    variables: Variables,
    tools: Tool[],
  ): string {
    const schemasString = this.mergeSystemSchemas(aiFunction);

    const result =
      EXECUTE_FUNCTION_PROMPT_TEMPLATE.render<ExecuteFunctionPromptParams>({
        history: history.toString(),
        jsonSchemas: schemasString,
        query: aiFunction.promptTemplate.render(variables),
        tools: tools.map((tool) => tool.toString()).join("\n"),
      });

    return result.trim();
  }
}
