export class AiFunctionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class InputValidationError extends AiFunctionError {
	public readonly validationErrors: unknown;
	constructor(message: string, validationErrors: unknown) {
		super(`Input validation failed: ${message}`);
		this.validationErrors = validationErrors;
	}
}

export class PromptCompilationError extends AiFunctionError {
	public readonly originalError?: unknown;
	constructor(message: string, originalError?: unknown) {
		super(`Prompt compilation failed: ${message}`);
		this.originalError = originalError;
	}
}

export class LLMError extends AiFunctionError {
	public readonly providerDetails?: unknown;
	constructor(message: string, providerDetails?: unknown) {
		super(`LLM provider error: ${message}`);
		this.providerDetails = providerDetails;
	}
}

export class OutputParsingError extends AiFunctionError {
	public readonly rawOutput: string;
	public readonly originalError?: unknown;
	constructor(message: string, rawOutput: string, originalError?: unknown) {
		super(`Output parsing failed: ${message}`);
		this.rawOutput = rawOutput;
		this.originalError = originalError;
	}
}

export class OutputValidationError extends AiFunctionError {
	public readonly parsedOutput: unknown;
	public readonly validationErrors: unknown;
	constructor(
		message: string,
		parsedOutput: unknown,
		validationErrors: unknown,
	) {
		super(`Output validation failed: ${message}`);
		this.parsedOutput = parsedOutput;
		this.validationErrors = validationErrors;
	}
}

export class MissingContextError extends AiFunctionError {
	constructor(message = "Execution context is missing.") {
		super(message);
	}
}

export class MaxRetriesExceededError extends AiFunctionError {
	public readonly lastError: Error;
	public readonly attempts: number;
	constructor(message: string, lastError: Error, attempts: number) {
		super(message);
		this.lastError = lastError;
		this.attempts = attempts;
	}
}
