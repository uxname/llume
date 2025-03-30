// src/schemas/common.ts
import { z } from "zod";

/**
 * A generic schema for representing arbitrary key-value pairs,
 * often used for function/tool inputs and outputs where the exact structure
 * is defined by more specific schemas.
 */
export const FunctionVariablesSchema = z.record(z.any());
export type FunctionVariables = z.infer<typeof FunctionVariablesSchema>;

// === LLM Response Schemas ===

/**
 * Schema for the `_type: "error"` response from the LLM.
 * Indicates that the LLM encountered an issue or could not fulfill the request.
 */
export const ErrorSchema = z.object({
  _type: z.literal("error"),
  _message: z
    .string()
    .describe("A message explaining the error or why the request failed."),
  // Optional: Include the invalid data that caused the error, e.g., during parsing
  _invalidData: z
    .any()
    .optional()
    .describe(
      "Optional: The data that caused the error (e.g., during parsing).",
    ),
});
export type ErrorPayload = z.infer<typeof ErrorSchema>;

/**
 * Schema for the `_type: "call_tool"` response from the LLM.
 * Indicates that the LLM needs to use a specific tool to proceed.
 */
export const CallToolSchema = z.object({
  _type: z.literal("call_tool"),
  _toolName: z.string().describe("The exact name of the tool to be called."),
  _input: FunctionVariablesSchema.describe(
    "The input data for the tool, matching the tool's inputSchema.",
  ),
});
export type ToolCallPayload = z.infer<typeof CallToolSchema>;

/**
 * Base schema for the `_type: "success"` response from the LLM.
 * This defines the basic structure, but the `_data` field will be
 * further specified by the target AI function's output schema.
 */
export const BaseSuccessSchema = z.object({
  _type: z.literal("success"),
  _data: FunctionVariablesSchema.describe(
    "The successful result data, matching the function's outputSchema.",
  ),
});
export type SuccessPayload<TData = FunctionVariables> = {
  _type: "success";
  _data: TData;
};

/**
 * A Zod discriminated union representing all possible structured responses
 * expected after parsing the raw LLM output *before* function-specific
 * output validation.
 *
 * Use `LlmResponse<T>` where T is the specific expected type for the `_data`
 * field in a successful response, typically inferred from an AiFunctionDefinition's outputSchema.
 */
export const LlmResponseSchema = z.discriminatedUnion("_type", [
  BaseSuccessSchema, // Represents the structure, specific data validation happens later
  ErrorSchema,
  CallToolSchema,
]);

/**
 * TypeScript type representing the possible structured LLM responses.
 * @template TData The expected type of the `_data` field in a successful response.
 */
export type LlmResponse<TData = FunctionVariables> =
  | SuccessPayload<TData>
  | ErrorPayload
  | ToolCallPayload;

// === Tool Execution Specific Schemas ===

/**
 * Schema representing an error that occurred specifically during tool execution
 * or tool output validation. This might be included in a HistoryMessage.
 */
export const ToolExecutionErrorSchema = z.object({
  _type: z.literal("tool_execution_error"),
  _message: z
    .string()
    .describe("Description of the error during tool execution or validation."),
  _invalidOutput: z
    .any()
    .optional()
    .describe("The invalid output produced by the tool, if applicable."),
  // You could add toolName here too if needed, though it's often in the parent structure
});
export type ToolExecutionErrorPayload = z.infer<
  typeof ToolExecutionErrorSchema
>;
