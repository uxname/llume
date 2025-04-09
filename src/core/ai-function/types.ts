import type { z } from "zod";
import type { OutputParser } from "../../parsing/output-parser.ts";
import type { ExecutionContext } from "../execution-context.ts";
import type { RetryOptions } from "../retry-options.ts";

export interface AiFunctionDefinition<TInput, TOutput> {
	inputSchema: z.ZodType<TInput>;
	outputSchema: z.ZodType<TOutput>;
	promptTemplate: string;
	systemPrompt?: string;
	outputParser?: OutputParser<TOutput>;
	retryOptions?: RetryOptions;
	llmOptions?: Record<string, unknown>;
	functionId?: string;
}

export type AiFunctionExecutable<TInput, TOutput> = (
	input: TInput,
	context?: ExecutionContext,
) => Promise<TOutput>;
