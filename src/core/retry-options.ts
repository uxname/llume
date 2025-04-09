import {AiFunctionError, LLMError, OutputParsingError, OutputValidationError,} from "./errors";

/** Function type to determine if a retry should occur based on the error. */
export type RetryConditionFn = (error: Error) => boolean;

/** Default condition for retrying: checks for common transient errors. */
export const defaultRetryCondition: RetryConditionFn = (
	error: Error,
): boolean => {
	// Retry on specific LLM errors (e.g., rate limits, server errors)
	// This check might need refinement based on specific provider error details/codes if available
	if (error instanceof LLMError) {
		// Example: Avoid retrying on authentication errors (401, 403) if identifiable
		// if (error.providerDetails?.statusCode === 401 || error.providerDetails?.statusCode === 403) {
		//     return false;
		// }
		return true; // Retry on most LLM errors by default
	}
	// Retry if LLM output was invalid JSON or didn't match the schema
	if (
		error instanceof OutputParsingError ||
		error instanceof OutputValidationError
	) {
		return true;
	}
	// Do not retry on other framework errors like InputValidationError, PromptCompilationError etc.
	// Also, do not retry on generic AiFunctionError unless explicitly handled above.
	if (error instanceof AiFunctionError) {
		return false;
	}
	// Optional: Decide whether to retry generic 'Error' types (could be network issues)
	// return true; // Could retry generic errors
	return false; // Safer default: Don't retry unknown generic errors
};

/** Configuration for retry behavior on errors. */
export interface RetryOptions {
	/** Maximum number of attempts (including the initial one). Defaults to 3. Min value is 1. */
	maxAttempts?: number;
	/**
	 * Delay between retry attempts in milliseconds.
	 * Can be a fixed number or a function receiving the attempt number (starting from 1 for the first retry)
	 * for implementing backoff strategies (e.g., exponential). Defaults to 200ms.
	 */
	delayMs?: number | ((attempt: number) => number);
	/** Function to decide if an error is eligible for retry. Defaults to checking LLM and output errors. */
	condition?: RetryConditionFn;
}

/** Default retry options. */
export const DEFAULT_RETRY_OPTIONS: Required<
	Pick<RetryOptions, "maxAttempts" | "delayMs">
> & { condition: RetryConditionFn } = {
	maxAttempts: 3,
	delayMs: 200,
	condition: defaultRetryCondition, // Use the default condition function
};

/**
 * Helper function to calculate the delay for the current retry attempt.
 * @internal
 */
export function getDelay(
	options: Required<Pick<RetryOptions, "maxAttempts" | "delayMs">>,
	attempt: number,
): number {
	const delayOption = options.delayMs;
	if (typeof delayOption === "function") {
		// Pass the *retry* attempt number (1 for first retry, 2 for second, etc.)
		// The main loop's 'attempt' variable includes the initial try (starts at 1).
		// So, for the first retry, attempt will be 2 in the main loop.
		const retryAttemptNumber = attempt - 1;
		return Math.max(0, delayOption(retryAttemptNumber)); // Ensure delay is non-negative
	}
	// Return fixed delay, ensuring non-negative
	return Math.max(0, delayOption);
}
