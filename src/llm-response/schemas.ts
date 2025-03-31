import { z } from "zod";
import { LLMResponseTypes } from "./types";

export const LLMResponseTypesSchema = z.nativeEnum(LLMResponseTypes);

export const BaseResponseSchema = z.object({
  type: LLMResponseTypesSchema,
});

export const ErrorResponseSchema = BaseResponseSchema.extend({
  type: z.literal(LLMResponseTypes.ERROR),
  message: z.string().describe("Error message"),
});

export function SuccessResponseSchema<TData>(dataSchema: z.ZodType<TData>) {
  return BaseResponseSchema.extend({
    type: z.literal(LLMResponseTypes.SUCCESS),
    data: dataSchema,
  });
}

export const CallToolResponseSchema = BaseResponseSchema.extend({
  type: z.literal(LLMResponseTypes.CALL_TOOL),
  tool_name: z.string().describe("The exact name of the tool to be called."),
  tool_input: z.any().describe("The input data for the tool"),
});

export function LlmResponseSchema(successDataSchema: z.ZodType) {
  return z.discriminatedUnion("type", [
    SuccessResponseSchema(successDataSchema),
    ErrorResponseSchema,
    CallToolResponseSchema,
  ]);
}
