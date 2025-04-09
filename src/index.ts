// Core function
export { createAiFunction } from "./core/ai-function";

// Core types and interfaces
export type { ExecutionContext } from "./core/execution-context";
export type { RetryOptions, RetryConditionFn } from "./core/retry-options";

// LLM related interfaces
export type {
	LLMProvider,
	LLMResponse,
	LLMGenerateOptions,
} from "./llm/llm-provider";

// Parsing interface (for custom parsers)
export type { OutputParser } from "./parsing/output-parser";

// Event handling interfaces and types
export type { EventHandler } from "./events/event-handler";
export { ExecutionEventType } from "./events/execution-event";
export type { ExecutionEvent } from "./events/execution-event";

// Custom Error classes
export {
	AiFunctionError,
	InputValidationError,
	OutputParsingError,
	OutputValidationError,
	LLMError,
	PromptCompilationError,
	MissingContextError,
	MaxRetriesExceededError,
} from "./core/errors";
export type { AiFunctionDefinition } from "./core/ai-function/types.ts";
export type { AiFunctionExecutable } from "./core/ai-function/types.ts";
