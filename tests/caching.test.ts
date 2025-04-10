import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
	type AiFunctionDefinition,
	type ExecutionContext,
	InMemoryCacheProvider,
	type LLMGenerateOptions,
	type LLMProvider,
	type LLMResponse,
	createAiFunction,
} from "../src"; // Adjust path if needed

// --- Test Setup ---

// Simple schemas for testing
const EchoInputSchema = z.object({
	message: z.string(),
});
type EchoInput = z.infer<typeof EchoInputSchema>;

const EchoOutputSchema = z.object({
	echo: z.string(),
});
type EchoOutput = z.infer<typeof EchoOutputSchema>;

// Mock LLM Provider that counts calls
class CallCountingLLMProvider implements LLMProvider {
	public callCount = 0;
	public lastReceivedPrompt: string | null = null;
	private readonly responsePrefix: string;

	constructor(responsePrefix = "Echo: ") {
		this.responsePrefix = responsePrefix;
	}

	async generate(
		prompt: string,
		options?: LLMGenerateOptions,
	): Promise<LLMResponse> {
		this.callCount++;
		this.lastReceivedPrompt = prompt;
		// Simulate finding the user message within the prompt
		const userQueryMatch = prompt.match(/USER QUERY:\s*([\s\S]+)/);
		const messageToEcho = userQueryMatch?.[1]?.trim() ?? "Unknown";

		const response: EchoOutput = {
			echo: `${this.responsePrefix}${messageToEcho}`,
		};
		return {
			rawOutput: JSON.stringify(response),
			modelInfo: { name: "CallCounter" },
		};
	}

	reset() {
		this.callCount = 0;
		this.lastReceivedPrompt = null;
	}
}

// --- Test Suite ---

describe("Caching Functionality", () => {
	let llmProvider: CallCountingLLMProvider;
	let cacheProvider: InMemoryCacheProvider;
	let executionContext: ExecutionContext;

	beforeEach(() => {
		llmProvider = new CallCountingLLMProvider();
		cacheProvider = new InMemoryCacheProvider({ maxSize: 10 }); // Small size for testing
		executionContext = {
			llmProvider: llmProvider,
			cacheProvider: cacheProvider,
			// eventHandler: new ConsoleEventHandler(), // Optional: for debugging
		};
	});

	afterEach(() => {
		vi.useRealTimers(); // Ensure timers are reset after each test
		cacheProvider.stopCleanupInterval(); // Stop timers if running
	});

	test("should cache the result and reuse it on subsequent identical calls", async () => {
		const echoDefinition: AiFunctionDefinition<EchoInput, EchoOutput> = {
			functionId: "cachingEcho",
			inputSchema: EchoInputSchema,
			outputSchema: EchoOutputSchema,
			userQueryTemplate: "{{{message}}}", // Simple user query
			cacheOptions: {
				enabled: true,
				// No TTL specified, uses cache provider default or infinite
			},
		};

		const echoAiFunc = createAiFunction(echoDefinition, executionContext);
		const input: EchoInput = { message: "Hello Cache!" };

		// First call - should miss cache, call LLM
		const result1 = await echoAiFunc(input);
		expect(llmProvider.callCount).toBe(1);
		expect(result1.echo).toBe("Echo: Hello Cache!");

		// Second call with identical input - should hit cache, NOT call LLM
		const result2 = await echoAiFunc(input);
		expect(llmProvider.callCount).toBe(1); // Count should NOT increase
		expect(result2).toEqual(result1); // Result should be the same

		// Third call with different input - should miss cache, call LLM again
		const input3: EchoInput = { message: "Different Input" };
		const result3 = await echoAiFunc(input3);
		expect(llmProvider.callCount).toBe(2); // Count should increase
		expect(result3.echo).toBe("Echo: Different Input");

		// Fourth call with the first input again - should hit cache
		const result4 = await echoAiFunc(input);
		expect(llmProvider.callCount).toBe(2); // Count should NOT increase
		expect(result4).toEqual(result1);
	});

	test("should respect cache TTL and re-call LLM after expiry", async () => {
		vi.useFakeTimers(); // Enable fake timers

		const ttlMs = 1000; // 1 second TTL

		const echoDefinitionTtl: AiFunctionDefinition<EchoInput, EchoOutput> = {
			functionId: "cachingEchoTtl",
			inputSchema: EchoInputSchema,
			outputSchema: EchoOutputSchema,
			userQueryTemplate: "{{{message}}}",
			cacheOptions: {
				enabled: true,
				ttl: ttlMs, // Set TTL
			},
		};

		const echoAiFuncTtl = createAiFunction(echoDefinitionTtl, executionContext);
		const input: EchoInput = { message: "Cache with TTL" };

		// First call - cache miss
		const result1 = await echoAiFuncTtl(input);
		expect(llmProvider.callCount).toBe(1);
		expect(result1.echo).toBe("Echo: Cache with TTL");

		// Advance time just before TTL expires
		await vi.advanceTimersByTimeAsync(ttlMs - 10);

		// Second call - should hit cache
		const result2 = await echoAiFuncTtl(input);
		expect(llmProvider.callCount).toBe(1);
		expect(result2).toEqual(result1);

		// Advance time past TTL expiry
		await vi.advanceTimersByTimeAsync(20); // Total elapsed > ttlMs

		// Third call - should miss cache (expired), call LLM again
		const result3 = await echoAiFuncTtl(input);
		expect(llmProvider.callCount).toBe(2);
		expect(result3.echo).toBe("Echo: Cache with TTL"); // Content is the same, but source is LLM

		// Fourth call - should hit cache again (re-cached on previous call)
		const result4 = await echoAiFuncTtl(input);
		expect(llmProvider.callCount).toBe(2);
		expect(result4).toEqual(result3);

		vi.useRealTimers(); // Restore real timers
	});

	test("should not use cache if cacheOptions.enabled is false", async () => {
		const echoDefinitionNoCache: AiFunctionDefinition<EchoInput, EchoOutput> = {
			functionId: "noCacheEcho",
			inputSchema: EchoInputSchema,
			outputSchema: EchoOutputSchema,
			userQueryTemplate: "{{{message}}}",
			cacheOptions: {
				enabled: false, // Explicitly disabled
			},
		};

		const echoAiFuncNoCache = createAiFunction(
			echoDefinitionNoCache,
			executionContext,
		);
		const input: EchoInput = { message: "No Caching" };

		// First call
		await echoAiFuncNoCache(input);
		expect(llmProvider.callCount).toBe(1);

		// Second call
		await echoAiFuncNoCache(input);
		expect(llmProvider.callCount).toBe(2); // LLM called again

		// Third call
		await echoAiFuncNoCache(input);
		expect(llmProvider.callCount).toBe(3); // LLM called again
	});

	test("should not use cache if cacheProvider is not in context", async () => {
		const echoDefinitionCacheEnabled: AiFunctionDefinition<
			EchoInput,
			EchoOutput
		> = {
			functionId: "cacheEnabledEcho",
			inputSchema: EchoInputSchema,
			outputSchema: EchoOutputSchema,
			userQueryTemplate: "{{{message}}}",
			cacheOptions: {
				enabled: true, // Cache enabled in definition...
			},
		};

		// ...but not provided in context
		const contextWithoutCache: ExecutionContext = {
			llmProvider: llmProvider,
			// cacheProvider: undefined, // Missing
		};

		const echoAiFunc = createAiFunction(
			echoDefinitionCacheEnabled,
			contextWithoutCache, // Use context without cache provider
		);
		const input: EchoInput = { message: "No Provider" };

		// First call
		await echoAiFunc(input);
		expect(llmProvider.callCount).toBe(1);

		// Second call
		await echoAiFunc(input);
		expect(llmProvider.callCount).toBe(2); // LLM called again because no provider
	});
});
