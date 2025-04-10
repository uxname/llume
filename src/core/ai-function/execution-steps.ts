import type Handlebars from "handlebars";
import { ZodError, type ZodSchema } from "zod";
import { ExecutionEventType } from "../../events/execution-event";
import type {
	LLMGenerateOptions,
	LLMProvider,
	LLMResponse,
} from "../../llm/llm-provider";
import type { OutputParser } from "../../parsing/output-parser";
import {
	InputValidationError,
	LLMError,
	OutputParsingError,
	OutputValidationError,
	PromptCompilationError,
} from "../errors";
import type { ExecutionContext } from "../execution-context";
import type { AiFunctionDefinition } from "./types";

export type PublishEventFn = (type: ExecutionEventType, data: unknown) => void;

export async function validateInput<TInput>(
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

export function compilePrompt<TInput>(
	validatedInput: TInput,
	definition: AiFunctionDefinition<TInput, unknown>, // Keep for context
	mainPromptTemplateDelegate: Handlebars.TemplateDelegate, // Always present (default or custom)
	userQueryTemplateDelegate: Handlebars.TemplateDelegate<TInput>,
	// parser: OutputParser<unknown>, // No longer needed here
	jsonSchemaString: string | null, // Pass generated schema for default template
	publishEvent: PublishEventFn,
): string {
	publishEvent(ExecutionEventType.PROMPT_COMPILATION_START, { validatedInput });
	try {
		// 1. Compile user query
		const compiledUserQuery = userQueryTemplateDelegate(validatedInput);

		// 2. Prepare variables for the main template
		const templateVariables = {
			...validatedInput,
			userQuery: compiledUserQuery, // Make compiled query available
			jsonSchema: jsonSchemaString, // Make schema available (used by default template)
		};

		// 3. Compile the main template
		const finalPrompt = mainPromptTemplateDelegate(templateVariables);

		// 4. Format instructions are now part of the mainPromptTemplate (default or custom)

		publishEvent(ExecutionEventType.PROMPT_COMPILATION_END, {
			compiledPrompt: finalPrompt,
		});
		return finalPrompt;
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

export async function callLlm(
	compiledPrompt: string,
	llmProvider: LLMProvider,
	llmOptions: LLMGenerateOptions & { cacheTtl?: number },
	publishEvent: PublishEventFn,
): Promise<LLMResponse> {
	publishEvent(ExecutionEventType.LLM_START, {
		compiledPrompt,
		llmOptions: llmOptions.llmOptions,
		cacheTtl: llmOptions.cacheTtl,
	});
	try {
		const providerOptions: LLMGenerateOptions = {
			llmOptions: llmOptions.llmOptions,
		};
		const llmResponse = await llmProvider.generate(
			compiledPrompt,
			providerOptions,
		);
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

export async function parseOutput<TOutput>(
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

export async function validateOutput<TOutput>(
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

export interface ExecuteSingleAttemptArgs<TInput, TOutput> {
	input: TInput;
	definition: AiFunctionDefinition<TInput, TOutput>;
	context: ExecutionContext;
	mainPromptTemplateDelegate: Handlebars.TemplateDelegate; // Renamed
	userQueryTemplateDelegate: Handlebars.TemplateDelegate<TInput>; // Renamed
	parser: OutputParser<TOutput>;
	publishEvent: PublishEventFn;
	effectiveLlmProvider: LLMProvider;
	jsonSchemaString: string | null; // Added
}

export async function executeSingleAttempt<TInput, TOutput>({
	input,
	definition,
	context,
	mainPromptTemplateDelegate,
	userQueryTemplateDelegate,
	parser,
	publishEvent,
	effectiveLlmProvider,
	jsonSchemaString, // Added
}: ExecuteSingleAttemptArgs<TInput, TOutput>): Promise<TOutput> {
	const validatedInput = await validateInput(
		input,
		definition.inputSchema,
		publishEvent,
	);

	const compiledPrompt = compilePrompt(
		validatedInput,
		definition,
		mainPromptTemplateDelegate,
		userQueryTemplateDelegate,
		// parser, // No longer needed here
		jsonSchemaString, // Pass schema string
		publishEvent,
	);

	const llmOptions: LLMGenerateOptions & { cacheTtl?: number } = {
		llmOptions: definition.llmOptions,
		cacheTtl: definition.cacheOptions?.ttl,
	};

	const llmResponse = await callLlm(
		compiledPrompt,
		effectiveLlmProvider,
		llmOptions,
		publishEvent,
	);

	const parsedOutput = await parseOutput(llmResponse, parser, publishEvent);

	const validatedOutput = await validateOutput(
		parsedOutput,
		definition.outputSchema,
		publishEvent,
	);

	return validatedOutput;
}
