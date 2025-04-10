// src/core/ai-function/index.ts
import Handlebars from "handlebars";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
	type ExecutionEvent,
	ExecutionEventType,
} from "../../events/execution-event";
import { CachingLLMProvider } from "../../llm/caching-llm-provider";
import type { LLMProvider } from "../../llm/llm-provider";
import { parseJson } from "../../parsing/internal-json-parser";
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

const DEFAULT_PROMPT_TEMPLATE = `You are a helpful AI assistant. You need to respond accurately to the user's query.
{{#if jsonSchema}}

RESPONSE INSTRUCTIONS:
You MUST respond ONLY with a valid JSON object that strictly matches to the JSON Schema provided below.
Do NOT include any explanatory text, comments, apologies, or markdown formatting (like \`\`\`) before or after the JSON object.
The JSON object MUST be the only content in your response.

JSON SCHEMA:
{{{jsonSchema}}}
{{/if}}

USER QUERY:
{{{userQuery}}}
`;

const USER_QUERY_PLACEHOLDER = "{{{userQuery}}}";
const JSON_SCHEMA_PLACEHOLDER = "{{{jsonSchema}}}";

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

	const usesDefaultJsonParser = !definition.outputParser;
	const parser: OutputParser<TOutput> = definition.outputParser ?? {
		parse: (rawOutput: string): Promise<TOutput> | TOutput => {
			return parseJson<TOutput>(rawOutput);
		},
	};

	const jsonSchemaString = usesDefaultJsonParser
		? generateJsonSchemaString(definition.outputSchema)
		: null;

	const mainPromptTemplateString =
		definition.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;

	// --- Template Validation ---
	if (definition.promptTemplate) {
		// Only validate if a custom template is provided
		if (!mainPromptTemplateString.includes(USER_QUERY_PLACEHOLDER)) {
			throw new PromptCompilationError(
				`Custom 'promptTemplate' must include the user query placeholder: ${USER_QUERY_PLACEHOLDER}`,
			);
		}
		if (
			usesDefaultJsonParser &&
			!mainPromptTemplateString.includes(JSON_SCHEMA_PLACEHOLDER)
		) {
			throw new PromptCompilationError(
				`Custom 'promptTemplate' must include the JSON schema placeholder '${JSON_SCHEMA_PLACEHOLDER}' when using the default JSON output parser.`,
			);
		}
	}
	// --- End Template Validation ---

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
					mainPromptTemplateDelegate,
					userQueryTemplateDelegate,
					parser,
					publishEvent,
					effectiveLlmProvider,
					jsonSchemaString,
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
