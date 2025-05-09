import type { z } from "zod";
import type { OutputParser } from "../../parsing/output-parser";
import type { ExecutionContext } from "../execution-context";
import type { RetryOptions } from "../retry-options";

export interface AiFunctionDefinition<TInput, TOutput> {
	inputSchema: z.ZodType<TInput>;
	outputSchema: z.ZodType<TOutput>;
	promptTemplate?: string;
	userQueryTemplate: string;
	outputParser?: OutputParser<TOutput>;
	retryOptions?: RetryOptions;
	llmOptions?: Record<string, unknown>;
	functionId?: string;
	cacheOptions?: {
		enabled?: boolean;
		ttl?: number;
	};
}

export type AiFunctionExecutable<TInput, TOutput> = (
	input: TInput,
	context?: ExecutionContext,
) => Promise<TOutput>;
