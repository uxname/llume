import { createHash } from "node:crypto";
import type { CacheProvider } from "../cache/cache-provider";
import { ExecutionEventType } from "../events/execution-event";
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
		const publishEvent = options?.publishEvent; // Get publish function from options

		let cachedResponse: LLMResponse | undefined;
		try {
			cachedResponse = await this.cacheProvider.get<LLMResponse>(cacheKey);
		} catch (error: unknown) {
			publishEvent?.(ExecutionEventType.CACHE_ERROR, {
				operation: "get",
				cacheKey,
				error: error instanceof Error ? error : new Error(String(error)),
			});
			// Proceed as if cache miss on error
		}

		if (cachedResponse) {
			publishEvent?.(ExecutionEventType.CACHE_HIT, {
				cacheKey,
				value: cachedResponse, // Log the cached value
			});
			return {
				...cachedResponse,
				modelInfo: { ...cachedResponse.modelInfo, fromCache: true },
			};
		}

		publishEvent?.(ExecutionEventType.CACHE_MISS, { cacheKey });

		// Cache miss, call the real provider
		// Pass the original options (including publishEvent) down,
		// although the real provider likely won't use publishEvent for cache events.
		const response = await this.realProvider.generate(prompt, options);

		const ttl = options?.cacheTtl ?? this.defaultTtl;
		publishEvent?.(ExecutionEventType.CACHE_WRITE, {
			cacheKey,
			value: response,
			ttl,
		});
		try {
			// Do not wait for the set operation to complete
			void this.cacheProvider.set(cacheKey, response, ttl);
		} catch (error: unknown) {
			publishEvent?.(ExecutionEventType.CACHE_ERROR, {
				operation: "set",
				cacheKey,
				value: response,
				ttl,
				error: error instanceof Error ? error : new Error(String(error)),
			});
			// Ignore set error, return the actual response
		}

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
