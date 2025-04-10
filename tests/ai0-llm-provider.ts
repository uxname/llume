import axios from "axios";
import {
	LLMError,
	type LLMGenerateOptions,
	type LLMProvider,
	type LLMResponse,
} from "../src";

export class Ai0Provider implements LLMProvider {
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
			throw new Error("[Ai0Provider] Base URL and API Key are required.");
		}
		this.baseUrl = baseUrl;
		this.apiKey = apiKey;
		this.defaultProvider = defaultProvider;
		this.requestTimeout = requestTimeout;
	}

	async generate(
		prompt: string,
		_options?: LLMGenerateOptions,
	): Promise<LLMResponse> {
		const params = {
			prompt: prompt,
			provider: this.defaultProvider,
			randomProvider: false,
		};

		try {
			const response = await axios.post<{ text: string }>(
				this.baseUrl,
				params,
				{
					headers: {
						"Content-Type": "application/json",
						Authorization: this.apiKey,
					},
					timeout: this.requestTimeout,
				},
			);

			if (response.status === 200 && response.data?.text) {
				return {
					rawOutput: response.data.text,
					modelInfo: {
						name: "Ai0",
						provider: this.defaultProvider,
					},
				};
			}

			throw new LLMError(
				`[Ai0Provider] Unexpected response status: ${response.status}`,
				response.data,
			);
		} catch (error) {
			if (axios.isAxiosError(error)) {
				throw new LLMError(
					`[Ai0Provider] Request failed: ${error.message}`,
					error.response?.data,
				);
			}
			throw new LLMError(
				`[Ai0Provider] Unknown error: ${error instanceof Error ? error.message : String(error)}`,
				error,
			);
		}
	}
}
