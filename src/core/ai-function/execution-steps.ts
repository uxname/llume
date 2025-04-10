import Handlebars from "handlebars"; // Ensure Handlebars is imported
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

const DEFAULT_MAIN_PROMPT_TEMPLATE =
	"{{#if systemPrompt}}{{systemPrompt}}\n\n{{/if}}{{userPromptContent}}";

let defaultCompiledMainTemplate: Handlebars.TemplateDelegate | null = null;

function getDefaultCompiledMainTemplate(): Handlebars.TemplateDelegate {
	if (!defaultCompiledMainTemplate) {
		defaultCompiledMainTemplate = Handlebars.compile(
			DEFAULT_MAIN_PROMPT_TEMPLATE,
			{ noEscape: true, strict: true },
		);
	}
	return defaultCompiledMainTemplate;
}

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
	definition: AiFunctionDefinition<TInput, unknown>, // Use unknown for TOutput here
	userPromptTemplate: Handlebars.TemplateDelegate<TInput>,
	mainPromptTemplateDelegate: Handlebars.TemplateDelegate | null, // Can be null if using default
	parser: OutputParser<unknown>,
	publishEvent: PublishEventFn,
): string {
	publishEvent(ExecutionEventType.PROMPT_COMPILATION_START, { validatedInput });
	try {
		// 1. Compile user prompt content
		const userPromptContent = userPromptTemplate(validatedInput);

		// 2. Select and compile main template
		const templateToUse =
			mainPromptTemplateDelegate ?? getDefaultCompiledMainTemplate();
		const finalPrompt = templateToUse({
			systemPrompt: definition.systemPrompt,
			userPromptContent: userPromptContent,
		});

		// 3. Add format instructions (if any)
		let promptWithInstructions = finalPrompt;
		const formatInstructions = parser.getFormatInstructions?.();
		if (formatInstructions) {
			promptWithInstructions += `\n\n${formatInstructions}`;
		}

		publishEvent(ExecutionEventType.PROMPT_COMPILATION_END, {
			compiledPrompt: promptWithInstructions,
		});
		return promptWithInstructions;
	} catch (error: unknown) {
		const message =
			error instanceof Error
				? error.message
				: "Prompt compilation failed at runtime";
		const compilationError = new PromptCompilationError(message, error);
		publishEvent(ExecutionEventType.PROMPT_COMPILATION_ERROR, {
			validatedInput,
			templateUsed: definition.mainPromptTemplate ? "custom" : "default",
			error: compilationError,
		});
		throw compilationError;
	}
}

export async function callLlm(
	compiledPrompt: string,
	llmProvider: LLMProvider,
	llmOptions: LLMGenerateOptions & { cacheTtl?: number }, // Pass cacheTtl if needed by provider wrapper
	publishEvent: PublishEventFn,
): Promise<LLMResponse> {
	publishEvent(ExecutionEventType.LLM_START, {
		compiledPrompt,
		systemPrompt: llmOptions.systemPrompt,
		llmOptions: llmOptions.llmOptions,
		cacheTtl: llmOptions.cacheTtl, // Log cache TTL if provided
	});
	try {
		// Pass all options, including potential cacheTtl, to the provider's generate method
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
	userPromptTemplate: Handlebars.TemplateDelegate<TInput>; // Renamed from compiledPromptTemplate
	mainPromptTemplateDelegate: Handlebars.TemplateDelegate | null; // Added
	parser: OutputParser<TOutput>;
	publishEvent: PublishEventFn;
	effectiveLlmProvider: LLMProvider; // Added to pass potentially wrapped provider
}

export async function executeSingleAttempt<TInput, TOutput>({
	input,
	definition,
	context, // Keep context for potential future use inside steps
	userPromptTemplate,
	mainPromptTemplateDelegate,
	parser,
	publishEvent,
	effectiveLlmProvider, // Use this provider
}: ExecuteSingleAttemptArgs<TInput, TOutput>): Promise<TOutput> {
	const validatedInput = await validateInput(
		input,
		definition.inputSchema,
		publishEvent,
	);

	const compiledPrompt = compilePrompt(
		validatedInput,
		definition, // Pass full definition
		userPromptTemplate,
		mainPromptTemplateDelegate,
		parser,
		publishEvent,
	);

	const llmOptions: LLMGenerateOptions & { cacheTtl?: number } = {
		systemPrompt: definition.systemPrompt, // System prompt is now handled by main template
		llmOptions: definition.llmOptions,
		cacheTtl: definition.cacheOptions?.ttl, // Pass cache TTL from definition
	};

	const llmResponse = await callLlm(
		compiledPrompt,
		effectiveLlmProvider, // Use the passed provider
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
