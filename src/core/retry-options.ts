import {
	AiFunctionError,
	LLMError,
	OutputParsingError,
	OutputValidationError,
} from "./errors";

export type RetryConditionFn = (error: Error) => boolean;

export const defaultRetryCondition: RetryConditionFn = (
	error: Error,
): boolean => {
	if (error instanceof LLMError) {
		return true;
	}
	if (
		error instanceof OutputParsingError ||
		error instanceof OutputValidationError
	) {
		return true;
	}
	if (error instanceof AiFunctionError) {
		return false;
	}

	return false;
};

export interface RetryOptions {
	maxAttempts?: number;
	delayMs?: number | ((attempt: number) => number);
	condition?: RetryConditionFn;
}

export const DEFAULT_RETRY_OPTIONS: Required<
	Pick<RetryOptions, "maxAttempts" | "delayMs">
> & { condition: RetryConditionFn } = {
	maxAttempts: 3,
	delayMs: 200,
	condition: defaultRetryCondition,
};

export function getDelay(
	options: Required<Pick<RetryOptions, "maxAttempts" | "delayMs">>,
	attempt: number,
): number {
	const delayOption = options.delayMs;
	if (typeof delayOption === "function") {
		const retryAttemptNumber = attempt - 1;
		return Math.max(0, delayOption(retryAttemptNumber));
	}
	return Math.max(0, delayOption);
}
