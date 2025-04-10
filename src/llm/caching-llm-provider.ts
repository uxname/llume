import { createHash } from "node:crypto";
import type { CacheProvider } from "../cache/cache-provider";
import type {
	LLMGenerateOptions,
	LLMProvider,
	LLMResponse,
} from "./llm-provider";

export interface CachingLLMProviderOptions {
	realProvider: LLMProvider;
	cacheProvider: CacheProvider;
	defaultTtl?: number;
}

export class CachingLLMProvider implements LLMProvider {
	private readonly realProvider: LLMProvider;
	private readonly cacheProvider: CacheProvider;
	private readonly defaultTtl?: number;

	constructor({
		realProvider,
		cacheProvider,
		defaultTtl,
	}: CachingLLMProviderOptions) {
		this.realProvider = realProvider;
		this.cacheProvider = cacheProvider;
		this.defaultTtl = defaultTtl;
	}

	async generate(
		prompt: string,
		options?: LLMGenerateOptions & { cacheTtl?: number },
	): Promise<LLMResponse> {
		const cacheKey = this.createCacheKey(prompt, options);
		const cachedResponse = await this.cacheProvider.get<LLMResponse>(cacheKey);

		if (cachedResponse) {
			return {
				...cachedResponse,
				modelInfo: { ...cachedResponse.modelInfo, fromCache: true },
			};
		}

		const response = await this.realProvider.generate(prompt, options);

		const ttl = options?.cacheTtl ?? this.defaultTtl;
		// Do not wait for the set operation to complete
		void this.cacheProvider.set(cacheKey, response, ttl);

		return {
			...response,
			modelInfo: { ...response.modelInfo, fromCache: false },
		};
	}

	private createCacheKey(prompt: string, options?: LLMGenerateOptions): string {
		const keyData = {
			prompt,
			llmOptions: options?.llmOptions,
		};
		const keyString = JSON.stringify(keyData);
		return createHash("sha256").update(keyString).digest("hex");
	}
}
