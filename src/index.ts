// src/index.ts

/**
 * Main entry point for the ai0-agent library.
 * Exports the core classes, types, and utilities needed to create,
 * configure, and run AI agents.
 */

// --- Core Components & Orchestration ---
export { Agent } from "./components/agent";
export type { AgentConfig } from "./core/agent-context"; // Export type, class is internal detail
export { AgentContext } from "./core/agent-context"; // Export class for advanced use cases (e.g. custom middleware needing instantiation checks)

// --- Component Definitions ---
export { AiFunctionDefinition } from "./components/ai-function";
export { ToolDefinition } from "./components/tool";
export { LLMProvider } from "./components/llm-provider";
export { History } from "./components/history";
export type {
  HistoryMessage,
  HistoryMessageContent,
  ToolResponsePayload,
} from "./components/history";

// --- LLM Providers ---
export { Ai0Llm } from "./providers/ai0-llm";
export type { Ai0LlmRequestParams } from "./providers/ai0-llm";

// --- Middleware ---
export { errorHandlerMiddleware } from "./middleware/error-handler.ts";
export { loggingMiddleware } from "./middleware/logging";
export { validationMiddleware } from "./middleware/validation";
export { historyManagerMiddleware } from "./middleware/history-manager.ts";
export { stateChangeLoggerMiddleware } from "./middleware/state-manager.ts";
// Export middleware types for creating custom middleware
export type { MiddlewareFn, NextFunction } from "./types/middleware";

// --- Prompts ---
export { PromptTemplate } from "./prompts/prompt-template";
// PromptBuilder is likely an internal detail, users interact via Agent/AiFunctionDefinition

// --- Schemas & Common Types ---
// Exporting the derived TypeScript types is generally more useful than the Zod objects themselves
export type {
  FunctionVariables,
  LlmResponse,
  SuccessPayload,
  ErrorPayload,
  ToolCallPayload,
  ToolExecutionErrorPayload,
} from "./schemas/common";
// Exporting Zod schemas might be useful for advanced validation tasks, uncomment if needed
// export {
//     FunctionVariablesSchema,
//     LlmResponseSchema,
//     BaseSuccessSchema,
//     ErrorSchema,
//     CallToolSchema,
//     ToolExecutionErrorSchema
// } from './schemas/common';

// --- Error Types ---
export {
  AgentError,
  ValidationError,
  LlmError,
  ToolExecutionError,
  MaxIterationsError,
  DefinitionNotFoundError,
} from "./core/errors";
