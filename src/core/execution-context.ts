import type { EventHandler } from "../events/event-handler";
import type { LLMProvider } from "../llm/llm-provider";

/** Context object providing dependencies needed during AI function execution. */
export interface ExecutionContext {
	/** The LLM provider instance to use for generating text. */
	llmProvider: LLMProvider;
	/** Optional handler for execution events (logging, tracing). */
	eventHandler?: EventHandler;
}
