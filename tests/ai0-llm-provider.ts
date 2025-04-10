import got, { HTTPError, RequestError } from "got";
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
			const response = await got.post<{ text: string }>(this.baseUrl, {
				json: params,
				headers: {
					"Content-Type": "application/json",
					Authorization: this.apiKey,
				},
				timeout: { request: this.requestTimeout },
				responseType: "json",
				throwHttpErrors: true,
			});

			// got resolves only on 2xx by default. Access status code via response.statusCode
			// Access parsed JSON body via response.body
			if (response.statusCode === 200 && response.body?.text) {
				return {
					rawOutput: response.body.text,
					modelInfo: {
						name: "Ai0",
						provider: this.defaultProvider,
					},
				};
			}

			// This part might be less likely to be reached if throwHttpErrors is true,
			// but kept for robustness in case of unexpected 2xx responses without text.
			throw new LLMError(
				`[Ai0Provider] Unexpected response status or missing text: ${response.statusCode}`,
				response.body,
			);
		} catch (error: unknown) {
			// Check if the error is an HTTPError from got (for non-2xx responses)
			if (error instanceof HTTPError) {
				throw new LLMError(
					`[Ai0Provider] Request failed with status ${error.response.statusCode}: ${error.message}`,
					// error.response.body contains the response body for the error
					error.response.body,
				);
			}
			// Check for other got request errors (network issues, timeouts, etc.)
			if (error instanceof RequestError) {
				throw new LLMError(
					`[Ai0Provider] Request failed: ${error.message}`,
					error, // Pass the original got error
				);
			}
			// Handle other types of errors
			throw new LLMError(
				`[Ai0Provider] Unknown error: ${error instanceof Error ? error.message : String(error)}`,
				error,
			);
		}
	}
}
