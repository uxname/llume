import Handlebars from "handlebars";
import { ZodError, type ZodSchema } from "zod";
import {
	type ExecutionEvent,
	ExecutionEventType,
} from "../../events/execution-event.ts";
import type {
	LLMGenerateOptions,
	LLMProvider,
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

// --- Типы для вспомогательных функций ---

type PublishEventFn = (type: ExecutionEventType, data: unknown) => void;

// --- Вспомогательные функции для этапов выполнения ---

/**
 * Валидирует входные данные с использованием предоставленной Zod-схемы.
 */
async function validateInput<TInput>(
	input: TInput,
	schema: ZodSchema<TInput>,
	publishEvent: PublishEventFn,
	functionId: string | undefined,
): Promise<TInput> {
	publishEvent(ExecutionEventType.INPUT_VALIDATION_START, { input });
	try {
		const validatedInput = await schema.parseAsync(input);
		publishEvent(ExecutionEventType.INPUT_VALIDATION_END, { validatedInput });
		return validatedInput;
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
}

/**
 * Компилирует промпт с использованием Handlebars и добавляет инструкции формата.
 */
function compilePrompt<TInput>(
	validatedInput: TInput,
	compiledTemplate: Handlebars.TemplateDelegate<TInput>,
	parser: OutputParser<unknown>, // Используем unknown, т.к. тип TOutput здесь не важен
	publishEvent: PublishEventFn,
	functionId: string | undefined,
): string {
	publishEvent(ExecutionEventType.PROMPT_COMPILATION_START, { validatedInput });
	try {
		let compiledPrompt = compiledTemplate(validatedInput);
		const formatInstructions = parser.getFormatInstructions?.();
		if (formatInstructions) {
			compiledPrompt += `\n\n${formatInstructions}`;
		}
		publishEvent(ExecutionEventType.PROMPT_COMPILATION_END, { compiledPrompt });
		return compiledPrompt;
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
}

/**
 * Вызывает LLM провайдер для генерации ответа.
 */
async function callLlm(
	compiledPrompt: string,
	llmProvider: LLMProvider,
	llmOptions: LLMGenerateOptions,
	publishEvent: PublishEventFn,
	functionId: string | undefined,
): Promise<LLMResponse> {
	publishEvent(ExecutionEventType.LLM_START, {
		compiledPrompt,
		systemPrompt: llmOptions.systemPrompt,
		llmOptions: llmOptions.llmOptions,
	});
	try {
		const llmResponse = await llmProvider.generate(compiledPrompt, llmOptions);
		publishEvent(ExecutionEventType.LLM_END, { response: llmResponse });
		return llmResponse;
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
}

/**
 * Парсит сырой вывод LLM с использованием предоставленного парсера.
 */
async function parseOutput<TOutput>(
	llmResponse: LLMResponse,
	parser: OutputParser<TOutput>,
	publishEvent: PublishEventFn,
	functionId: string | undefined,
): Promise<TOutput> {
	publishEvent(ExecutionEventType.OUTPUT_PARSING_START, {
		rawOutput: llmResponse.rawOutput,
	});
	try {
		const parsedOutput = await parser.parse(llmResponse.rawOutput);
		publishEvent(ExecutionEventType.OUTPUT_PARSING_END, { parsedOutput });
		return parsedOutput;
	} catch (error: unknown) {
		const parsingError =
			error instanceof OutputParsingError
				? error
				: new OutputParsingError(
						error instanceof Error ? error.message : "Unknown parsing error",
						llmResponse.rawOutput,
						error,
					);
		publishEvent(ExecutionEventType.OUTPUT_PARSING_ERROR, {
			rawOutput: llmResponse.rawOutput,
			error: parsingError,
		});
		throw parsingError;
	}
}

/**
 * Валидирует распарсенный вывод с использованием предоставленной Zod-схемы.
 */
async function validateOutput<TOutput>(
	parsedOutput: TOutput,
	schema: ZodSchema<TOutput>,
	publishEvent: PublishEventFn,
	functionId: string | undefined,
): Promise<TOutput> {
	publishEvent(ExecutionEventType.OUTPUT_VALIDATION_START, { parsedOutput });
	try {
		const validatedOutput = await schema.parseAsync(parsedOutput);
		publishEvent(ExecutionEventType.OUTPUT_VALIDATION_END, { validatedOutput });
		return validatedOutput;
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
}

// --- Основная функция создания AI-функции ---

export function createAiFunction<TInput, TOutput>(
	definition: AiFunctionDefinition<TInput, TOutput>,
	defaultContext?: ExecutionContext,
): AiFunctionExecutable<TInput, TOutput> {
	const functionId = definition.functionId;

	// --- Настройка параметров ---
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

	// --- Предварительная компиляция шаблона ---
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

	// --- Возвращаемая исполняемая функция ---
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
		const { llmProvider, eventHandler } = context;

		// --- Вспомогательная функция для публикации событий ---
		const publishEvent: PublishEventFn = (
			type: ExecutionEventType,
			data: unknown,
		): void => {
			try {
				const timestamp = Date.now();
				// Типы eventHandler и ExecutionEvent явно известны из импортов
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

		// --- Логика выполнения с попытками ---
		let attempt = 1;
		let lastError: Error | null = null;

		while (attempt <= finalRetryOptions.maxAttempts) {
			try {
				// 1. Валидация ввода
				const validatedInput = await validateInput(
					input,
					definition.inputSchema,
					publishEvent,
					functionId,
				);

				// 2. Компиляция промпта
				const compiledPrompt = compilePrompt(
					validatedInput,
					compiledPromptTemplate,
					parser,
					publishEvent,
					functionId,
				);

				// 3. Вызов LLM
				const llmOptions: LLMGenerateOptions = {
					systemPrompt: definition.systemPrompt,
					llmOptions: definition.llmOptions,
				};
				const llmResponse = await callLlm(
					compiledPrompt,
					llmProvider,
					llmOptions,
					publishEvent,
					functionId,
				);

				// 4. Парсинг вывода
				const parsedOutput = await parseOutput(
					llmResponse,
					parser,
					publishEvent,
					functionId,
				);

				// 5. Валидация вывода
				const validatedOutput = await validateOutput(
					parsedOutput,
					definition.outputSchema,
					publishEvent,
					functionId,
				);

				// --- Успешное выполнение ---
				publishEvent(ExecutionEventType.AI_FUNCTION_END, {
					output: validatedOutput,
				});
				return validatedOutput;
			} catch (error: unknown) {
				// --- Обработка ошибок и логика повторных попыток ---
				if (!(error instanceof Error)) {
					lastError = new AiFunctionError(
						`Unknown non-error value thrown: ${error}`,
					);
				} else {
					lastError = error;
				}

				const shouldRetry =
					attempt < finalRetryOptions.maxAttempts &&
					finalRetryOptions.condition(lastError);

				if (shouldRetry) {
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
					// Ошибка после последней попытки или если условие retry=false
					const finalError =
						attempt >= finalRetryOptions.maxAttempts &&
						finalRetryOptions.condition(lastError) // Только если ошибка произошла на последней *допустимой* попытке
							? new MaxRetriesExceededError(
									`Max retries (${finalRetryOptions.maxAttempts}) exceeded for function ${functionId ?? "unknown"}. Last error: ${lastError.message}`,
									lastError,
									attempt,
								)
							: lastError; // Иначе используем последнюю возникшую ошибку

					publishEvent(ExecutionEventType.AI_FUNCTION_END, {
						error: finalError,
					});
					throw finalError;
				}
			}
		} // Конец цикла while

		// --- Этот блок теоретически не должен достигаться ---
		// Если цикл завершился без return или throw (что маловероятно при текущей логике),
		// выбрасываем последнюю зарегистрированную ошибку или общую ошибку.
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
