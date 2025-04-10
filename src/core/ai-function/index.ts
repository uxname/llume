import Handlebars from "handlebars";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema"; // Keep import
import {
	type ExecutionEvent,
	ExecutionEventType,
} from "../../events/execution-event";
import { CachingLLMProvider } from "../../llm/caching-llm-provider";
import type { LLMProvider } from "../../llm/llm-provider";
import { parseJson } from "../../parsing/internal-json-parser"; // Removed getJsonFormatInstructions import
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

// Function to generate the JSON schema string
function generateJsonSchemaString<TOutput>(
	schema: z.ZodType<TOutput>,
): string | null {
	try {
		const jsonSchema = zodToJsonSchema(schema, {
			target: "jsonSchema7",
			$refStrategy: "none",
		});
		// biome-ignore lint/performance/noDelete: Cleaning schema object
		delete jsonSchema.$schema;
		// biome-ignore lint/performance/noDelete: Cleaning schema object
		delete jsonSchema.default;
		// biome-ignore lint/performance/noDelete: Cleaning schema object
		delete jsonSchema.definitions;
		return JSON.stringify(jsonSchema, null, 2);
	} catch (error: unknown) {
		console.warn(
			"Could not generate JSON schema from Zod schema for default prompt.",
			error,
		);
		return null;
	}
}

// Default main prompt template string
const DEFAULT_PROMPT_TEMPLATE = `You are a helpful AI assistant. Respond accurately to the user's request.
{{#if jsonSchema}}

RESPONSE FORMATTING INSTRUCTIONS:
You MUST respond ONLY with a valid JSON object that strictly adheres to the JSON Schema provided below.
Do NOT include any explanatory text, comments, apologies, or markdown formatting (like \`\`\`) before or after the JSON object.
The JSON object MUST be the only content in your response.

JSON SCHEMA:
\`\`\`json
{{{jsonSchema}}}
\`\`\`
{{/if}}

USER QUERY:
{{{userQuery}}}`;

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
		// No getFormatInstructions needed for default parser
	};

	// Generate JSON schema string (used only if default prompt template is used)
	const jsonSchemaString = generateJsonSchemaString(definition.outputSchema);

	// Determine and compile the main prompt template
	const mainPromptTemplateString =
		definition.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;
	let mainPromptTemplateDelegate: Handlebars.TemplateDelegate;
	try {
		mainPromptTemplateDelegate = Handlebars.compile(mainPromptTemplateString, {
			noEscape: true,
			strict: true,
		});
	} catch (e: unknown) {
		const message =
			e instanceof Error
				? e.message
				: "Main prompt template compilation failed";
		throw new PromptCompilationError(message, e);
	}

	// Compile the user query template
	let userQueryTemplateDelegate: Handlebars.TemplateDelegate<TInput>;
	try {
		userQueryTemplateDelegate = Handlebars.compile<TInput>(
			definition.userQueryTemplate,
			{ noEscape: true, strict: true },
		);
	} catch (e: unknown) {
		const message =
			e instanceof Error ? e.message : "User query template compilation failed";
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
		const { eventHandler, llmProvider, cacheProvider } = context;

		let effectiveLlmProvider: LLMProvider = llmProvider;
		if (definition.cacheOptions?.enabled === true && cacheProvider) {
			effectiveLlmProvider = new CachingLLMProvider({
				realProvider: llmProvider,
				cacheProvider: cacheProvider,
				defaultTtl: definition.cacheOptions.ttl,
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
					context,
					mainPromptTemplateDelegate, // Pass compiled delegate
					userQueryTemplateDelegate, // Pass compiled delegate
					parser,
					publishEvent,
					effectiveLlmProvider,
					jsonSchemaString, // Pass schema string for default template usage
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
