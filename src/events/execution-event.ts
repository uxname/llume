/** Defines the types of events that can occur during AI function execution. */
export enum ExecutionEventType {
	AI_FUNCTION_START = "AI_FUNCTION_START",
	AI_FUNCTION_END = "AI_FUNCTION_END",
	INPUT_VALIDATION_START = "INPUT_VALIDATION_START",
	INPUT_VALIDATION_END = "INPUT_VALIDATION_END",
	INPUT_VALIDATION_ERROR = "INPUT_VALIDATION_ERROR",
	PROMPT_COMPILATION_START = "PROMPT_COMPILATION_START",
	PROMPT_COMPILATION_END = "PROMPT_COMPILATION_END",
	PROMPT_COMPILATION_ERROR = "PROMPT_COMPILATION_ERROR",
	LLM_START = "LLM_START",
	LLM_END = "LLM_END",
	LLM_ERROR = "LLM_ERROR",
	RETRY_ATTEMPT = "RETRY_ATTEMPT", // Event for each retry attempt
	OUTPUT_PARSING_START = "OUTPUT_PARSING_START",
	OUTPUT_PARSING_END = "OUTPUT_PARSING_END",
	OUTPUT_PARSING_ERROR = "OUTPUT_PARSING_ERROR",
	OUTPUT_VALIDATION_START = "OUTPUT_VALIDATION_START",
	OUTPUT_VALIDATION_END = "OUTPUT_VALIDATION_END",
	OUTPUT_VALIDATION_ERROR = "OUTPUT_VALIDATION_ERROR",
}

/** Represents a single event during the execution of an AI function. */
export interface ExecutionEvent {
	/** The type of the event. */
	type: ExecutionEventType;
	/** High-resolution timestamp of the event occurrence. */
	timestamp: number; // Use performance.now() or Date.now()
	/** Optional identifier of the AI function definition. */
	functionId?: string;
	/** Data associated with the event, structure depends on the event type. */
	data: unknown; // Specific types should be used where possible in handlers
}
