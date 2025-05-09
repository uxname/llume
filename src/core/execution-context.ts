import type { CacheProvider } from "../cache/cache-provider";
import type { EventHandler } from "../events/event-handler";
import type { LLMProvider } from "../llm/llm-provider";

export interface ExecutionContext {
	llmProvider: LLMProvider;
	eventHandler?: EventHandler;
	cacheProvider?: CacheProvider;
}
