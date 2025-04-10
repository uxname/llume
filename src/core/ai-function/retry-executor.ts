import { ExecutionEventType } from "../../events/execution-event";
import { AiFunctionError, MaxRetriesExceededError } from "../errors";
import {
	type RetryConditionFn,
	type RetryOptions,
	getDelay,
} from "../retry-options";
import type { PublishEventFn } from "./execution-steps";

export interface ExecuteWithRetryPolicyArgs<TOutput> {
	operation: () => Promise<TOutput>;
	retryOptions: Required<RetryOptions> & { condition: RetryConditionFn };
	publishEvent: PublishEventFn;
	functionId?: string;
}

export async function executeWithRetryPolicy<TOutput>({
	operation,
	retryOptions,
	publishEvent,
	functionId,
}: ExecuteWithRetryPolicyArgs<TOutput>): Promise<TOutput> {
	let attempt = 1;
	let lastError: Error | null = null;

	while (attempt <= retryOptions.maxAttempts) {
		try {
			return await operation();
		} catch (error: unknown) {
			if (!(error instanceof Error)) {
				lastError = new AiFunctionError(
					`Unknown non-error value thrown: ${String(error)}`,
				);
			} else {
				lastError = error;
			}

			const shouldRetry =
				attempt < retryOptions.maxAttempts && retryOptions.condition(lastError);

			if (shouldRetry) {
				const delay = getDelay(retryOptions, attempt);
				publishEvent(ExecutionEventType.RETRY_ATTEMPT, {
					attempt,
					maxAttempts: retryOptions.maxAttempts,
					delayMs: delay,
					error: lastError,
				});
				await new Promise((resolve) => setTimeout(resolve, delay));
				attempt++;
			} else {
				const finalError =
					attempt >= retryOptions.maxAttempts &&
					retryOptions.condition(lastError)
						? new MaxRetriesExceededError(
								`Max retries (${retryOptions.maxAttempts}) exceeded for function ${functionId ?? "unknown"}. Last error: ${lastError.message}`,
								lastError,
								attempt,
							)
						: lastError;

				throw finalError;
			}
		}
	}

	throw (
		lastError ??
		new AiFunctionError(
			"Exited retry loop unexpectedly without success or a final error.",
		)
	);
}
