// src/core/ai-function/index.ts
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

// --- Type definition for the event publishing helper ---
type PublishEventFn = (type: ExecutionEventType, data: unknown) => void;

// --- Helper functions for individual execution steps ---

/**
 * Validates input data using the provided Zod schema.
 */
async function validateInput<TInput>(
	input: TInput,
	schema: ZodSchema<TInput>,
	publishEvent: PublishEventFn,
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
 * Compiles the prompt using Handlebars and adds format instructions.
 */
function compilePrompt<TInput>(
	validatedInput: TInput,
	compiledTemplate: Handlebars.TemplateDelegate<TInput>,
	parser: OutputParser<unknown>, // Using unknown as TOutput is not needed here
	publishEvent: PublishEventFn,
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
 * Calls the LLM provider to generate a response.
 */
async function callLlm(
	compiledPrompt: string,
	llmProvider: LLMProvider,
	llmOptions: LLMGenerateOptions,
	publishEvent: PublishEventFn,
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
 * Parses the raw LLM output using the provided parser.
 */
async function parseOutput<TOutput>(
	llmResponse: LLMResponse,
	parser: OutputParser<TOutput>,
	publishEvent: PublishEventFn,
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
 * Validates the parsed output using the provided Zod schema.
 */
async function validateOutput<TOutput>(
	parsedOutput: TOutput,
	schema: ZodSchema<TOutput>,
	publishEvent: PublishEventFn,
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

// --- Core execution logic for a single attempt ---

interface PerformAttemptArgs<TInput, TOutput> {
	input: TInput;
	definition: AiFunctionDefinition<TInput, TOutput>;
	context: ExecutionContext;
	compiledPromptTemplate: Handlebars.TemplateDelegate<TInput>;
	parser: OutputParser<TOutput>;
	publishEvent: PublishEventFn;
}

/**
 * Executes a single attempt of the AI function pipeline (validation to validation).
 */
async function _performAttempt<TInput, TOutput>({
	input,
	definition,
	context,
	compiledPromptTemplate,
	parser,
	publishEvent,
}: PerformAttemptArgs<TInput, TOutput>): Promise<TOutput> {
	// 1. Validate Input
	const validatedInput = await validateInput(
		input,
		definition.inputSchema,
		publishEvent,
	);

	// 2. Compile Prompt
	const compiledPrompt = compilePrompt(
		validatedInput,
		compiledPromptTemplate,
		parser,
		publishEvent,
	);

	// 3. Call LLM
	const llmOptions: LLMGenerateOptions = {
		systemPrompt: definition.systemPrompt,
		llmOptions: definition.llmOptions,
	};
	const llmResponse = await callLlm(
		compiledPrompt,
		context.llmProvider,
		llmOptions,
		publishEvent,
	);

	// 4. Parse Output
	const parsedOutput = await parseOutput(llmResponse, parser, publishEvent);

	// 5. Validate Output
	const validatedOutput = await validateOutput(
		parsedOutput,
		definition.outputSchema,
		publishEvent,
	);

	return validatedOutput;
}

// --- Retry logic wrapper ---

interface WithRetriesArgs<TInput, TOutput> {
	operation: () => Promise<TOutput>; // The function to attempt (e.g., _performAttempt)
	retryOptions: Required<RetryOptions> & { condition: RetryConditionFn };
	publishEvent: PublishEventFn;
	functionId?: string;
}

/**
 * Wraps an operation with retry logic based on the provided options.
 */
async function _withRetries<TInput, TOutput>({
	operation,
	retryOptions,
	publishEvent,
	functionId,
}: WithRetriesArgs<TInput, TOutput>): Promise<TOutput> {
	let attempt = 1;
	let lastError: Error | null = null;

	while (attempt <= retryOptions.maxAttempts) {
		try {
			// Execute the core operation
			return await operation();
		} catch (error: unknown) {
			// --- Error handling and retry logic ---
			if (!(error instanceof Error)) {
				lastError = new AiFunctionError(
					`Unknown non-error value thrown: ${error}`,
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
				// Error after the last attempt or if retry condition is false
				const finalError =
					attempt >= retryOptions.maxAttempts &&
					retryOptions.condition(lastError) // Only wrap if error occurred on the last *allowed* retry attempt
						? new MaxRetriesExceededError(
								`Max retries (${retryOptions.maxAttempts}) exceeded for function ${functionId ?? "unknown"}. Last error: ${lastError.message}`,
								lastError,
								attempt,
							)
						: lastError; // Otherwise, use the last error encountered

				// Note: AI_FUNCTION_END event with error is published outside this function
				throw finalError;
			}
		} // End catch
	} // End while loop

	// This block should theoretically not be reached if maxAttempts >= 1
	// If the loop finishes without returning or throwing (unlikely with current logic),
	// throw the last recorded error or a generic error.
	throw (
		lastError ??
		new AiFunctionError(
			"Exited retry loop unexpectedly without success or a final error.",
		)
	);
}

// --- Main function factory ---

export function createAiFunction<TInput, TOutput>(
	definition: AiFunctionDefinition<TInput, TOutput>,
	defaultContext?: ExecutionContext,
): AiFunctionExecutable<TInput, TOutput> {
	const functionId = definition.functionId;

	// --- Setup: Compile template, configure retry options, select parser ---
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
			return parseJson<TOutput>(rawOutput); // Default to JSON parsing
		},
		getFormatInstructions: (): string => {
			// Default to JSON format instructions based on output schema
			return getJsonFormatInstructions(definition.outputSchema);
		},
	};

	// Pre-compile the Handlebars template once during creation
	let compiledPromptTemplate: Handlebars.TemplateDelegate<TInput>;
	try {
		compiledPromptTemplate = Handlebars.compile<TInput>(
			definition.promptTemplate,
			{
				noEscape: true, // Keep template syntax like {{{expression}}}
				strict: true, // Throw errors for missing variables
			},
		);
	} catch (e: unknown) {
		const message =
			e instanceof Error ? e.message : "Handlebars template compilation failed";
		// Throw error during creation if template is invalid
		throw new PromptCompilationError(message, e);
	}

	// --- Return the executable AI function ---
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
		const { eventHandler } = context; // LLM Provider is accessed within _performAttempt via context

		// --- Event publishing helper specific to this execution ---
		const publishEvent: PublishEventFn = (
			type: ExecutionEventType,
			data: unknown,
		): void => {
			if (!eventHandler) return; // Don't try to publish if no handler
			try {
				const timestamp = Date.now();
				// Cast to ExecutionEvent is safe here based on imports
				eventHandler.publish({
					type,
					timestamp,
					functionId,
					data,
				} as ExecutionEvent);
			} catch (e) {
				// Log errors during event publishing but don't fail the execution
				console.error(
					`Error publishing event ${type} for function ${functionId ?? "unknown"}:`,
					e,
				);
			}
		};

		publishEvent(ExecutionEventType.AI_FUNCTION_START, { input });

		try {
			// Define the operation to be retried
			const operationToRetry = () =>
				_performAttempt({
					input,
					definition,
					context,
					compiledPromptTemplate,
					parser,
					publishEvent,
				});

			// Execute the operation with retry logic
			const result = await _withRetries({
				operation: operationToRetry,
				retryOptions: finalRetryOptions,
				publishEvent,
				functionId,
			});

			// --- Successful execution ---
			publishEvent(ExecutionEventType.AI_FUNCTION_END, { output: result });
			return result;
		} catch (error: unknown) {
			// --- Final error handling after retries (or non-retryable error) ---
			publishEvent(ExecutionEventType.AI_FUNCTION_END, {
				error:
					error instanceof Error ? error : new AiFunctionError(String(error)),
			});
			throw error; // Re-throw the final error
		}
	};
}
