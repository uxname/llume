import Handlebars from "handlebars";
import {
	type ExecutionEvent,
	ExecutionEventType,
} from "../../events/execution-event";
import { CachingLLMProvider } from "../../llm/caching-llm-provider"; // Added import
import type { LLMProvider } from "../../llm/llm-provider"; // Added import
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

	let userPromptTemplate: Handlebars.TemplateDelegate<TInput>;
	try {
		userPromptTemplate = Handlebars.compile<TInput>(definition.promptTemplate, {
			noEscape: true,
			strict: true,
		});
	} catch (e: unknown) {
		const message =
			e instanceof Error
				? e.message
				: "User prompt template compilation failed";
		throw new PromptCompilationError(message, e);
	}

	let mainPromptTemplateDelegate: Handlebars.TemplateDelegate | null = null;
	if (definition.mainPromptTemplate) {
		try {
			mainPromptTemplateDelegate = Handlebars.compile(
				definition.mainPromptTemplate,
				{ noEscape: true, strict: true },
			);
		} catch (e: unknown) {
			const message =
				e instanceof Error
					? e.message
					: "Main prompt template compilation failed";
			throw new PromptCompilationError(message, e);
		}
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
		const { eventHandler, llmProvider, cacheProvider } = context;

		let effectiveLlmProvider: LLMProvider = llmProvider;
		if (definition.cacheOptions?.enabled === true && cacheProvider) {
			effectiveLlmProvider = new CachingLLMProvider({
				realProvider: llmProvider,
				cacheProvider: cacheProvider,
				defaultTtl: definition.cacheOptions.ttl, // Pass default TTL for this function
			});
		}

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
					context, // Pass original context
					userPromptTemplate,
					mainPromptTemplateDelegate,
					parser,
					publishEvent,
					effectiveLlmProvider, // Pass the potentially wrapped provider
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
