export interface LLMGenerateOptions {
	llmOptions?: Record<string, unknown>;
	systemPrompt?: string; // Keep for potential direct use by providers, though core logic doesn't pass it
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
