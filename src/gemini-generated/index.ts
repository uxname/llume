// src/index.ts

/**
 * Main entry point for the ai0-agent library.
 * Exports the core classes, types, and utilities needed to create,
 * configure, and run AI agents.
 */

// --- Core Components & Orchestration ---
export { Agent } from "./components/agent.ts";
export type { AgentConfig } from "./core/agent-context.ts"; // Export type, class is internal detail
export { AgentContext } from "./core/agent-context.ts"; // Export class for advanced use cases (e.g. custom middleware needing instantiation checks)

// --- Component Definitions ---
export { AiFunctionDefinition } from "./components/ai-function.ts";
export { ToolDefinition } from "./components/tool.ts";
export { LLMProvider } from "./components/llm-provider.ts";
export { History } from "./components/history.ts";
export type {
  HistoryMessage,
  HistoryMessageContent,
  ToolResponsePayload,
} from "./components/history.ts";

// --- LLM Providers ---
export { Ai0Llm } from "./providers/ai0-llm.ts";
export type { Ai0LlmRequestParams } from "./providers/ai0-llm.ts";

// --- Middleware ---
export { errorHandlerMiddleware } from "./middleware/error-handler.ts";
export { loggingMiddleware } from "./middleware/logging.ts";
export { validationMiddleware } from "./middleware/validation.ts";
export { historyManagerMiddleware } from "./middleware/history-manager.ts";
export { stateChangeLoggerMiddleware } from "./middleware/state-manager.ts";
// Export middleware types for creating custom middleware
export type { MiddlewareFn, NextFunction } from "./types/middleware.ts";

// --- Prompts ---
export { PromptTemplate } from "./prompts/prompt-template.ts";
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
} from "./schemas/common.ts";
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
} from "./core/errors.ts";
