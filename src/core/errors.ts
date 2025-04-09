// src/core/errors.ts

/** Base class for all framework-specific errors. */
export class AiFunctionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}

/** Error during input validation against the Zod schema. */
export class InputValidationError extends AiFunctionError {
	constructor(
		message: string,
		public readonly validationErrors: unknown,
	) {
		// Consider using ZodError type if Zod is a direct dependency
		super(`Input validation failed: ${message}`);
		this.validationErrors = validationErrors;
	}
}

/** Error during prompt template compilation (e.g., Handlebars error). */
export class PromptCompilationError extends AiFunctionError {
	constructor(
		message: string,
		public readonly originalError?: unknown,
	) {
		super(`Prompt compilation failed: ${message}`);
		this.originalError = originalError;
	}
}

/** Error related to the LLM provider (network, API key, etc.). */
export class LLMError extends AiFunctionError {
	constructor(
		message: string,
		public readonly providerDetails?: unknown,
	) {
		super(`LLM provider error: ${message}`);
		this.providerDetails = providerDetails;
	}
}

/** Error during the parsing of the LLM's raw output. */
export class OutputParsingError extends AiFunctionError {
	constructor(
		message: string,
		public readonly rawOutput: string,
		public readonly originalError?: unknown,
	) {
		super(`Output parsing failed: ${message}`);
		this.rawOutput = rawOutput;
		this.originalError = originalError;
	}
}

/** Error during the validation of the parsed output against the Zod schema. */
export class OutputValidationError extends AiFunctionError {
	constructor(
		message: string,
		public readonly parsedOutput: unknown,
		public readonly validationErrors: unknown,
	) {
		// Consider using ZodError type
		super(`Output validation failed: ${message}`);
		this.parsedOutput = parsedOutput;
		this.validationErrors = validationErrors;
	}
}

/** Error when ExecutionContext is required but not provided. */
export class MissingContextError extends AiFunctionError {
	constructor(message = "Execution context is missing.") {
		super(message);
	}
}

/** Error when max retry attempts are exceeded. */
export class MaxRetriesExceededError extends AiFunctionError {
	constructor(
		message: string,
		public readonly lastError: Error,
		public readonly attempts: number,
	) {
		super(message);
		this.lastError = lastError;
		this.attempts = attempts;
	}
}
