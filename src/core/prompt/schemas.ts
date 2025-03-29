import { z } from "zod";
import type { ExecutionContext } from "../execution-context.ts";

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

export type SuccessPayload = z.infer<typeof BaseSuccessSchema>;

export type ErrorPayload = z.infer<typeof ErrorSchema>;

export type ToolCallPayload = z.infer<typeof CallToolSchema>;

export type LlmResponse<T> =
  | { _type: "success"; _data: T }
  | ErrorPayload
  | ToolCallPayload;

export enum EventType {
  LLM_REQUEST = "llm_request",
  LLM_RESPONSE = "llm_response",
  TOOL_REQUEST = "tool_request",
  TOOL_RESPONSE = "tool_response",
  STATE_UPDATE = "state_update",
}

export interface MiddlewareEvent<TInput = unknown, TOutput = unknown> {
  type: EventType;
  initiator: "user" | "llm" | "system";
  functionName?: string;
  toolName?: string;
  input?: TInput;
  output?: TOutput;
  timestamp: number;
  executionContext: ExecutionContext;
}
export interface StateUpdateEvent extends MiddlewareEvent {
  type: EventType.STATE_UPDATE;
  initiator: "system";
}
