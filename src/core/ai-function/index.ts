import Handlebars from "handlebars";
import {
	type ExecutionEvent,
	ExecutionEventType,
} from "../../events/execution-event";
import {
	getJsonFormatInstructions,
	parseJson,
} from "../../parsing/internal-json-parser";
import type { OutputParser } from "../../parsing/output-parser";
import {
	AiFunctionError,
	MissingContextError,
	PromptCompilationError,
} from "../errors";
import type { ExecutionContext } from "../execution-context";
import {
	DEFAULT_RETRY_OPTIONS,
	type RetryConditionFn,
	type RetryOptions,
} from "../retry-options";
import { type PublishEventFn, executeSingleAttempt } from "./execution-steps";
import { executeWithRetryPolicy } from "./retry-executor";
import type { AiFunctionDefinition, AiFunctionExecutable } from "./types";

export function createAiFunction<TInput, TOutput>(
	definition: AiFunctionDefinition<TInput, TOutput>,
	defaultContext?: ExecutionContext,
): AiFunctionExecutable<TInput, TOutput> {
	const functionId = definition.functionId;

	const finalRetryOptions: Required<RetryOptions> & {
		condition: RetryConditionFn;
	} = {
		maxAttempts:
			definition.retryOptions?.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts,
		delayMs: definition.retryOptions?.delayMs ?? DEFAULT_RETRY_OPTIONS.delayMs,
		condition:
			definition.retryOptions?.condition ?? DEFAULT_RETRY_OPTIONS.condition,
	};

	const parser: OutputParser<TOutput> = definition.outputParser ?? {
		parse: (rawOutput: string): TOutput => {
			return parseJson<TOutput>(rawOutput);
		},
		getFormatInstructions: (): string => {
			return getJsonFormatInstructions(definition.outputSchema);
		},
	};

	let compiledPromptTemplate: Handlebars.TemplateDelegate<TInput>;
	try {
		compiledPromptTemplate = Handlebars.compile<TInput>(
			definition.promptTemplate,
			{
				noEscape: true,
				strict: true,
			},
		);
	} catch (e: unknown) {
		const message =
			e instanceof Error ? e.message : "Handlebars template compilation failed";
		throw new PromptCompilationError(message, e);
	}

	return async (
		input: TInput,
		runtimeContext?: ExecutionContext,
	): Promise<TOutput> => {
		const context = runtimeContext ?? defaultContext;
		if (!context) {
			throw new MissingContextError(
				"Execution context must be provided either at creation time or at runtime.",
			);
		}
		const { eventHandler } = context;

		const publishEvent: PublishEventFn = (
			type: ExecutionEventType,
			data: unknown,
		): void => {
			if (!eventHandler) return;
			try {
				const timestamp = Date.now();
				eventHandler.publish({
					type,
					timestamp,
					functionId,
					data,
				} as ExecutionEvent);
			} catch (e) {
				console.error(
					`Error publishing event ${type} for function ${functionId ?? "unknown"}:`,
					e,
				);
			}
		};

		publishEvent(ExecutionEventType.AI_FUNCTION_START, { input });

		try {
			const operationToRetry = () =>
				executeSingleAttempt<TInput, TOutput>({
					input,
					definition,
					context,
					compiledPromptTemplate,
					parser,
					publishEvent,
				});

			const result = await executeWithRetryPolicy<TOutput>({
				operation: operationToRetry,
				retryOptions: finalRetryOptions,
				publishEvent,
				functionId,
			});

			publishEvent(ExecutionEventType.AI_FUNCTION_END, { output: result });
			return result;
		} catch (error: unknown) {
			publishEvent(ExecutionEventType.AI_FUNCTION_END, {
				error:
					error instanceof Error ? error : new AiFunctionError(String(error)),
			});
			throw error;
		}
	};
}
