export interface LLMGenerateOptions {
	systemPrompt?: string;
	llmOptions?: Record<string, unknown>;
}

export interface LLMResponse {
	rawOutput: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
	modelInfo?: Record<string, unknown>;
}

export interface LLMProvider {
	generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
}
