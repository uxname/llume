import axios from "axios";
import {
	LLMError,
	type LLMGenerateOptions,
	type LLMProvider,
	type LLMResponse,
} from "../src";
import type { Ai0LlmRequestParams } from "../src/old-core/llm/providers/ai0/ai0-llm-provider.ts";

export class Ai0 implements LLMProvider {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly defaultProvider: string;
	private readonly requestTimeout: number;

	constructor(
		baseUrl: string,
		apiKey: string,
		defaultProvider = "gemini",
		requestTimeout = 60000,
	) {
		if (!baseUrl || !apiKey) {
			throw new Error("[Ai0Llm] Base URL and API Key are required.");
		}
		this.baseUrl = baseUrl;
		this.apiKey = apiKey;
		this.defaultProvider = defaultProvider;
		this.requestTimeout = requestTimeout;
	}

	async generate(
		_prompt: string,
		options?: LLMGenerateOptions,
	): Promise<LLMResponse> {
		const prompt = options?.systemPrompt
			? `${options.systemPrompt} ${_prompt}`
			: _prompt;

		const params: Ai0LlmRequestParams = {
			prompt,
			provider: this.defaultProvider,
			randomProvider: false,
		};

		const response = await axios.post<{ text: string }>(this.baseUrl, params, {
			headers: {
				"Content-Type": "application/json",
				Authorization: this.apiKey,
			},
			timeout: this.requestTimeout,
		});

		if (response.status === 200 && response.data && response.data.text) {
			return {
				rawOutput: response.data.text,
				modelInfo: {
					name: "Ai0",
					version: "1.0.0",
				},
			};
		}

		throw new LLMError("[AI0] Unexpected response", response.data);
	}
}
