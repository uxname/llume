import type { PublishEventFn } from "../core/ai-function/execution-steps";

export interface LLMGenerateOptions {
	llmOptions?: Record<string, unknown>;
	systemPrompt?: string;
	publishEvent?: PublishEventFn;
}

export interface LLMResponse {
	rawOutput: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
	modelInfo?: Record<string, unknown> & { fromCache?: boolean };
}

export interface LLMProvider {
	generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
}
