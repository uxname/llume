import { z } from "zod";

export const VariablesSchema = z.record(z.any());

export const CallToolSchema = z.object({
  _type: z.literal("call_tool"),
  _toolName: z.string().describe("The name of the tool to call"),
  _input: VariablesSchema,
});

export const BaseSuccessSchema = z.object({
  _type: z.literal("success"),
  _data: VariablesSchema,
});

export const ErrorSchema = z.object({
  _type: z.literal("error"),
  _message: z.string(),
});

export type BaseSuccessType = z.infer<typeof BaseSuccessSchema>;

export type ErrorType = z.infer<typeof ErrorSchema>;

export type CallToolType = z.infer<typeof CallToolSchema>;

export type LLMResult<T> =
  | { _type: "success"; _data: T }
  | ErrorType
  | CallToolType;
