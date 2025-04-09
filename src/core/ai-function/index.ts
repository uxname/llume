import Handlebars from "handlebars";
import { ZodError } from "zod";
import {
	type ExecutionEvent,
	ExecutionEventType,
} from "../../events/execution-event.ts";
import type {
	LLMGenerateOptions,
	LLMResponse,
} from "../../llm/llm-provider.ts";
import {
	getJsonFormatInstructions,
	parseJson,
} from "../../parsing/internal-json-parser";
import type { OutputParser } from "../../parsing/output-parser.ts";
import {
	AiFunctionError,
	InputValidationError,
	LLMError,
	MaxRetriesExceededError,
	MissingContextError,
	OutputParsingError,
	OutputValidationError,
	PromptCompilationError,
} from "../errors.ts";
import type { ExecutionContext } from "../execution-context.ts";
import {
	DEFAULT_RETRY_OPTIONS,
	type RetryConditionFn,
	type RetryOptions,
	getDelay,
} from "../retry-options.ts";
import type { AiFunctionDefinition, AiFunctionExecutable } from "./types.ts";

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

	// --- The Executable Function ---
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
		// **** Типы llmProvider и eventHandler теперь явно известны из импортов ****
		const { llmProvider, eventHandler } = context;

		// Helper to publish events safely
		const publishEvent = (type: ExecutionEventType, data: unknown): void => {
			try {
				const timestamp = Date.now();
				// **** Тип eventHandler и ExecutionEvent явно известны ****
				eventHandler?.publish({
					type,
					timestamp,
					functionId,
					data,
				} as ExecutionEvent);
			} catch (e) {
				console.error(
					`Error publishing event ${type} for function ${functionId}:`,
					e,
				);
			}
		};

		publishEvent(ExecutionEventType.AI_FUNCTION_START, { input });

		let attempt = 1;
		let lastError: Error | null = null;

		while (attempt <= finalRetryOptions.maxAttempts) {
			try {
				// 1. --- Input Validation ---
				publishEvent(ExecutionEventType.INPUT_VALIDATION_START, { input });
				let validatedInput: TInput;
				try {
					validatedInput = await definition.inputSchema.parseAsync(input);
					publishEvent(ExecutionEventType.INPUT_VALIDATION_END, {
						validatedInput,
					});
				} catch (error: unknown) {
					const validationError = new InputValidationError(
						error instanceof ZodError
							? error.errors
									.map((e) => `${e.path.join(".")}: ${e.message}`)
									.join(", ")
							: "Unknown validation error",
						error instanceof ZodError ? error.errors : error,
					);
					publishEvent(ExecutionEventType.INPUT_VALIDATION_ERROR, {
						input,
						error: validationError,
					});
					throw validationError;
				}

				// 2. --- Prompt Compilation ---
				publishEvent(ExecutionEventType.PROMPT_COMPILATION_START, {
					validatedInput,
				});
				let compiledPrompt: string;
				try {
					compiledPrompt = compiledPromptTemplate(validatedInput);
					const formatInstructions = parser.getFormatInstructions?.();
					if (formatInstructions) {
						compiledPrompt += `\n\n${formatInstructions}`;
					}
					publishEvent(ExecutionEventType.PROMPT_COMPILATION_END, {
						compiledPrompt,
					});
				} catch (error: unknown) {
					const message =
						error instanceof Error
							? error.message
							: "Prompt compilation failed at runtime";
					const compilationError = new PromptCompilationError(message, error);
					publishEvent(ExecutionEventType.PROMPT_COMPILATION_ERROR, {
						validatedInput,
						error: compilationError,
					});
					throw compilationError;
				}

				// 3. --- LLM Call ---
				// **** Тип LLMGenerateOptions явно известен ****
				const llmOptions: LLMGenerateOptions = {
					systemPrompt: definition.systemPrompt,
					llmOptions: definition.llmOptions,
				};
				publishEvent(ExecutionEventType.LLM_START, {
					compiledPrompt,
					systemPrompt: llmOptions.systemPrompt,
					llmOptions: llmOptions.llmOptions,
				});
				// **** Тип LLMResponse явно известен ****
				let llmResponse: LLMResponse;
				try {
					// **** Тип llmProvider явно известен ****
					llmResponse = await llmProvider.generate(compiledPrompt, llmOptions);
					publishEvent(ExecutionEventType.LLM_END, { response: llmResponse });
				} catch (error: unknown) {
					const llmError =
						error instanceof LLMError
							? error
							: new LLMError(
									error instanceof Error
										? error.message
										: "Unknown LLM provider error",
									error,
								);
					publishEvent(ExecutionEventType.LLM_ERROR, { error: llmError });
					throw llmError;
				}

				// 4. --- Output Parsing ---
				publishEvent(ExecutionEventType.OUTPUT_PARSING_START, {
					rawOutput: llmResponse.rawOutput,
				});
				let parsedOutput: TOutput;
				try {
					parsedOutput = await parser.parse(llmResponse.rawOutput);
					publishEvent(ExecutionEventType.OUTPUT_PARSING_END, { parsedOutput });
				} catch (error: unknown) {
					const parsingError =
						error instanceof OutputParsingError
							? error
							: new OutputParsingError(
									error instanceof Error
										? error.message
										: "Unknown parsing error",
									llmResponse.rawOutput,
									error,
								);
					publishEvent(ExecutionEventType.OUTPUT_PARSING_ERROR, {
						rawOutput: llmResponse.rawOutput,
						error: parsingError,
					});
					throw parsingError;
				}

				// 5. --- Output Validation ---
				publishEvent(ExecutionEventType.OUTPUT_VALIDATION_START, {
					parsedOutput,
				});
				let validatedOutput: TOutput;
				try {
					validatedOutput =
						await definition.outputSchema.parseAsync(parsedOutput);
					publishEvent(ExecutionEventType.OUTPUT_VALIDATION_END, {
						validatedOutput,
					});
				} catch (error: unknown) {
					const validationError = new OutputValidationError(
						error instanceof ZodError
							? error.errors
									.map((e) => `${e.path.join(".")}: ${e.message}`)
									.join(", ")
							: "Unknown validation error",
						parsedOutput,
						error instanceof ZodError ? error.errors : error,
					);
					publishEvent(ExecutionEventType.OUTPUT_VALIDATION_ERROR, {
						parsedOutput,
						error: validationError,
					});
					throw validationError;
				}

				// --- Success ---
				publishEvent(ExecutionEventType.AI_FUNCTION_END, {
					output: validatedOutput,
				});
				return validatedOutput;
			} catch (error: unknown) {
				if (!(error instanceof Error)) {
					lastError = new AiFunctionError(
						`Unknown non-error value thrown: ${error}`,
					);
				} else {
					lastError = error;
				}

				// --- Retry Logic ---
				if (
					attempt < finalRetryOptions.maxAttempts &&
					finalRetryOptions.condition(lastError)
				) {
					const delay = getDelay(finalRetryOptions, attempt);
					publishEvent(ExecutionEventType.RETRY_ATTEMPT, {
						attempt,
						maxAttempts: finalRetryOptions.maxAttempts,
						delayMs: delay,
						error: lastError,
					});
					await new Promise((resolve) => setTimeout(resolve, delay));
					attempt++;
				} else {
					const finalError =
						attempt >= finalRetryOptions.maxAttempts &&
						finalRetryOptions.condition(lastError)
							? new MaxRetriesExceededError(
									`Max retries (${finalRetryOptions.maxAttempts}) exceeded for function ${functionId ?? "unknown"}. Last error: ${lastError.message}`,
									lastError,
									attempt,
								)
							: lastError;

					publishEvent(ExecutionEventType.AI_FUNCTION_END, {
						error: finalError,
					});
					throw finalError;
				}
			}
		} // End of while loop

		const finalUnreachableError =
			lastError ??
			new AiFunctionError(
				"Exited retry loop unexpectedly without success or a final error.",
			);
		publishEvent(ExecutionEventType.AI_FUNCTION_END, {
			error: finalUnreachableError,
		});
		throw finalUnreachableError;
	};
}
