export interface LLMGenerateOptions {
	systemPrompt?: string;
	llmOptions?: Record<string, unknown>; // Use unknown for flexibility, specific providers can narrow this
}

/** Response from the LLM provider. */
export interface LLMResponse {
	/** The raw text output from the LLM. */
	rawOutput: string;
	/** Optional: Token usage information. */
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
	/** Optional: Information about the model used. */
	modelInfo?: Record<string, unknown>;
}

/** Interface for interacting with a Large Language Model provider. */
export interface LLMProvider {
	/**
	 * Generates text based on a prompt and options.
	 * @param prompt The main user prompt.
	 * @param options Optional configuration including system prompt and provider settings.
	 * @returns A promise resolving to the LLMResponse.
	 * @throws {LLMError} If the provider encounters an issue (API error, network error, etc.).
	 */
	generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
}
