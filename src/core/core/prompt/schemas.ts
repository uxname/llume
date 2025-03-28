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

export const StateCommandSchema = z.object({
  _type: z.literal("change_state"),
  _command: z.union([
    z.literal("add").describe("Add a key-value pair to the state"),
    z.literal("remove").describe("Remove a key-value pair from the state"),
    z.literal("update").describe("Update a key-value pair in the state"),
    z.literal("clear").describe("Clear the state"),
  ]),
  _key: z.string(),
  _value: z.string(),
});

export type StateCommandType = z.infer<typeof StateCommandSchema>;

export type LLMResult<T> =
  | { _type: "success"; _data: T }
  | ErrorType
  | StateCommandType
  | CallToolType;
