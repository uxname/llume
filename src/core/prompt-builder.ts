import { EXECUTE_FUNCTION_PROMPT_TEMPLATE } from "./prompts/execute-function.ts";
import { History } from "./base-classes/history.ts";
import { z } from "zod";
import type {
  StatelessFunction,
  Variables,
} from "./base-classes/stateless-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";

type ExecuteFunctionPromptParams = {
  history: string;
  jsonSchemas: string;
  query: string;
};

const VariablesSchema = z.record(z.any());

const BaseSuccessSchema = z.object({
  _type: z.literal("success"),
  _data: VariablesSchema,
});
export type BaseSuccessType = z.infer<typeof BaseSuccessSchema>;

const ErrorSchema = z.object({
  _type: z.literal("error"),
  _message: z.string(),
});
export type ErrorType = z.infer<typeof ErrorSchema>;

const CallToolSchema = z.object({
  _type: z.literal("call_tool"),
  _toolName: z.string(),
  _input: VariablesSchema,
});
export type CallToolType = z.infer<typeof CallToolSchema>;

export type LLMResult<T> =
  | { _type: "success"; _data: T }
  | ErrorType
  | CallToolType;

export class PromptBuilder {
  public static mergeSystemSchemas(aiFunction: StatelessFunction): string {
    const SuccessSchemaWithData = BaseSuccessSchema.extend({
      _data: aiFunction.outputSchema,
    });

    const systemSchemas = z.discriminatedUnion("_type", [
      SuccessSchemaWithData,
      ErrorSchema,
      CallToolSchema,
    ]);

    return JSON.stringify(zodToJsonSchema(systemSchemas));
  }

  public static buildExecuteFunctionPrompt(
    history: History,
    aiFunction: StatelessFunction,
    variables: Variables,
  ): string {
    const schemasString = this.mergeSystemSchemas(aiFunction);

    const result =
      EXECUTE_FUNCTION_PROMPT_TEMPLATE.render<ExecuteFunctionPromptParams>({
        history: history.toString(),
        jsonSchemas: schemasString,
        query: aiFunction.promptTemplate.render(variables),
      });

    return result.trim();
  }
}
