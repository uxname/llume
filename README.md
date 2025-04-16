# LLume

[![npm version](https://badge.fury.io/js/llume.svg)](https://badge.fury.io/js/llume)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Git Repository](https://img.shields.io/badge/repo-GitHub-blue.svg)](https://github.com/uxname/llume)

**LLume** is a lightweight, type-safe Node.js framework designed to streamline the creation and execution of structured, predictable interactions with Large Language Models (LLMs). It emphasizes developer experience through strong typing, clear abstractions, and built-in utilities for common LLM workflow patterns.

## TLDR - Quick Examples

### Simple AI calculator

```typescript
import { z } from "zod";
import { createAiFunction } from "llume";

// 1. Define schemas
const schemas = {
	input: z.object({
		expression: z.string()
	}),
	output: z.object({
		result: z.number().describe("The numerical result of the calculation")
	})
};

// 2. Create AI function
const calculate = createAiFunction({
	functionId: "calculator",
	inputSchema: schemas.input,
	outputSchema: schemas.output,
	userQueryTemplate: "Calculate: {{{expression}}}",
}, {
	llmProvider: new YourLLMProvider(),
});

// 3. Use!
const result = await calculate({ expression: "10 * (5 + 3)" });
console.log(result.result); // 80
```

## Core Concept: `AiFunction`

The central abstraction in LLume is the `AiFunction`. It represents a single, reusable task delegated to an LLM, defined by:

*   **Input Schema (Zod):** Specifies the structure and types of the data required to execute the function. Ensures runtime validation.
*   **Output Schema (Zod):** Defines the expected structure and types of the JSON object the LLM should return. Enables safe parsing and validation of the LLM's response.
*   **Prompt Templates (Handlebars):**
    *   `userQueryTemplate`: Constructs the specific user request using variables from the validated input.
    *   `promptTemplate` (Optional): Defines the overall structure of the prompt sent to the LLM, integrating the `userQuery`, system instructions, and potentially the required JSON schema (derived from the output schema). A robust default template is provided if this is omitted.
*   **LLM Provider:** An abstraction (`LLMProvider` interface) to interact with any LLM API (e.g., OpenAI, Anthropic, Gemini, or custom providers like the example `Ai0Provider`).
*   **Execution Context:** A container (`ExecutionContext`) for shared resources like the `LLMProvider`, caching mechanisms (`CacheProvider`), and event handlers (`EventHandler`).
*   **Configuration:** Fine-grained control over retries (attempts, delays, conditions), caching (TTL, enabling/disabling), and LLM-specific parameters.

## Features

*   ✨ **Type Safety:** Leverages [Zod](https://zod.dev/) for rigorous compile-time and runtime validation of inputs and outputs.
*   📝 **Structured Output:** Enforces reliable JSON output from LLMs by automatically including JSON schema instructions in the default prompt.
*   🔧 **Flexible Prompting:** Utilizes [Handlebars](https://handlebarsjs.com/) for dynamic prompt templating, allowing complex logic and full control over the prompt structure.
*   🔄 **LLM Agnostic:** Designed to work with any LLM through a simple `LLMProvider` interface with built-in caching capabilities.
*   🔁 **Robust Error Handling:** Comprehensive error handling system with specific error types and automatic retries for transient failures.
*   ⚡ **Advanced Caching:** Flexible caching system with pluggable providers and TTL support to optimize performance and costs.
*   📢 **Event-Driven Architecture:** Rich event system for monitoring, logging, and debugging the entire execution lifecycle.
*   🧩 **Modular Design:** Clean separation of concerns with dedicated modules for core functionality, LLM integration, parsing, caching, and events.
*   🚫 **Defensive Programming:** Built-in validation at every step with clear error messages and recovery strategies.

## Table of Contents

*   [Installation](#installation)
*   [Quick Start Example](#quick-start-example)
*   [API Overview](#api-overview)
    *   [`createAiFunction`](#createaifunctiondefinition-defaultcontext)
    *   [`AiFunctionDefinition`](#aifunctiondefinition)
    *   [`ExecutionContext`](#executioncontext)
    *   [`LLMProvider`](#llmprovider)
    *   [`CacheProvider` / `InMemoryCacheProvider`](#cacheprovider--inmemorycacheprovider)
    *   [`EventHandler`](#eventhandler)
    *   [Error Classes](#error-classes)
*   [Advanced Usage](#advanced-usage)
    *   [Custom Prompt Structure](#custom-prompt-structure)
    *   [Caching LLM Responses](#caching-llm-responses)
    *   [Monitoring with Events](#monitoring-with-events)
*   [Technology Stack](#technology-stack)
*   [Development & Testing](#development--testing)
*   [Contributing](#contributing)
*   [License](#license)

## Installation

```bash
npm install llume
# or
yarn add llume
# or
bun add llume
```

**Note:** LLume uses `zod`, `handlebars`, and `zod-to-json-schema` internally. You don't need to install them separately unless you use them directly in your project code.

## Quick Start Example

```typescript
import { z } from "zod";
import {
	createAiFunction,
	type ExecutionContext,
	type AiFunctionDefinition,
	type LLMProvider, // Interface for LLM interaction
	type LLMResponse, // Expected response structure from LLMProvider
	// Optional built-in cache:
	InMemoryCacheProvider,
	// Optional event handler example:
	type EventHandler,
	type ExecutionEvent,
	ExecutionEventType
} from "llume";

// --- Example Implementations (Replace with your actual providers) ---

// 1. Mock LLM Provider (Replace with your actual LLM API client)
class MockLLMProvider implements LLMProvider {
	async generate(prompt: string): Promise<LLMResponse> {
		console.log("\n--- Mock LLM Received Prompt ---\n", prompt);
		// Simulate response based on prompt analysis
		let sentiment = "neutral";
		let confidence = 0.5;
		if (prompt.toLowerCase().includes("great") || prompt.toLowerCase().includes("easier")) {
			sentiment = "positive";
			confidence = 0.95;
		} else if (prompt.toLowerCase().includes("bad") || prompt.toLowerCase().includes("difficult")) {
			sentiment = "negative";
			confidence = 0.85;
		}
		const rawOutput = JSON.stringify({ sentiment, confidence });
		console.log("--- Mock LLM Sending Response ---\n", rawOutput);
		return { rawOutput, modelInfo: { name: "MockLLM/v1" } };
	}
}

// 2. Simple Console Event Handler (Optional: for observing execution)
class ConsoleEventHandler implements EventHandler {
	publish(event: ExecutionEvent): void {
		// Log specific events or all events
		if (event.type === ExecutionEventType.PROMPT_COMPILATION_END) {
			// Log less verbose info for this event
			console.log(`[EVENT: ${event.type}] Compiled prompt generated.`);
		} else if (event.type === ExecutionEventType.CACHE_HIT) {
            console.log(`[EVENT: ${event.type}] Cache hit for key: ${event.data.cacheKey}`);
        } else if (event.type === ExecutionEventType.CACHE_MISS) {
            console.log(`[EVENT: ${event.type}] Cache miss for key: ${event.data.cacheKey}`);
        }
         else {
			console.log(`[EVENT: ${event.type}]`, JSON.stringify(event.data, null, 2));
		}
	}
}

// --- Define the AiFunction ---

// 3. Define Input and Output Schemas using Zod
const SentimentInputSchema = z.object({
	textToAnalyze: z.string().min(5, "Text must be at least 5 characters long"),
});
type SentimentInput = z.infer<typeof SentimentInputSchema>;

const SentimentOutputSchema = z.object({
	sentiment: z.enum(["positive", "negative", "neutral"]).describe("The detected sentiment"),
	confidence: z.number().min(0).max(1).describe("Confidence score (0.0 to 1.0)"),
});
type SentimentOutput = z.infer<typeof SentimentOutputSchema>;

// 4. Define the AiFunction structure
const analyzeSentimentDefinition: AiFunctionDefinition<
	SentimentInput,
	SentimentOutput
> = {
	functionId: "sentimentAnalyzerV1", // Useful for logging/tracing
	inputSchema: SentimentInputSchema,
	outputSchema: SentimentOutputSchema,
	// userQueryTemplate is mandatory: Uses Handlebars syntax {{variableName}}
	userQueryTemplate: "Perform sentiment analysis on the following text: {{{textToAnalyze}}}",
	// promptTemplate is optional: If omitted, a default template enforcing JSON output based on outputSchema is used.
	// retryOptions: { maxAttempts: 2 }, // Optional: Default is 3 attempts
	cacheOptions: { enabled: true, ttl: 60000 }, // Optional: Enable caching for 1 minute
};

// 5. Prepare Execution Context
const executionContext: ExecutionContext = {
	llmProvider: new MockLLMProvider(),
	// Optional: Add cache and event handler
	cacheProvider: new InMemoryCacheProvider({ maxSize: 100 }), // Keep up to 100 items
	eventHandler: new ConsoleEventHandler(),
};

// 6. Create the Executable Function
const analyzeSentiment = createAiFunction(analyzeSentimentDefinition, executionContext);

// 7. Execute the Function
async function runAnalysis() {
	const input1: SentimentInput = {
		textToAnalyze: "LLume is a great framework, it makes working with LLMs so much easier!",
	};
	const input2: SentimentInput = {
		textToAnalyze: "This documentation could be clearer in some sections.",
	};

	try {
		console.log("\n--- Running Analysis 1 ---");
		const result1 = await analyzeSentiment(input1);
		console.log("Analysis 1 Result:", result1); // Expected: { sentiment: 'positive', confidence: ~0.95 }

		console.log("\n--- Running Analysis 1 (Again - Should hit cache) ---");
		const result1_cached = await analyzeSentiment(input1);
		console.log("Analysis 1 (Cached) Result:", result1_cached); // Should be identical to result1

		console.log("\n--- Running Analysis 2 ---");
		const result2 = await analyzeSentiment(input2);
		console.log("Analysis 2 Result:", result2); // Expected: { sentiment: 'neutral' or 'negative', confidence: ... }

        // Example of invalid input
		console.log("\n--- Running Analysis 3 (Invalid Input) ---");
        const invalidInput = { textToAnalyze: "Hi" }; // Too short
		// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
        await analyzeSentiment(invalidInput as any);

	} catch (error: any) {
		console.error("\n--- ERROR ---");
        // Log specific error types
		if (error.name === "InputValidationError") {
            console.error(`Input Validation Failed: ${error.message}`);
            console.error("Details:", error.validationErrors);
        } else {
            console.error("An unexpected error occurred:", error);
        }
	}
}

runAnalysis();
```

## API Overview

### `createAiFunction(definition, defaultContext?)`

The main factory function to create an executable AI function instance.

*   `definition: AiFunctionDefinition<TInput, TOutput>`: The configuration object defining the function's behavior (see below).
*   `defaultContext?: ExecutionContext`: A default execution context containing providers (`llmProvider`, `cacheProvider`, `eventHandler`). If provided, it's used unless overridden by a context passed during function execution.

Returns: `AiFunctionExecutable<TInput, TOutput>`, which is an async function:
`(input: TInput, runtimeContext?: ExecutionContext) => Promise<TOutput>`.

### `AiFunctionDefinition`

The core configuration object passed to `createAiFunction`.

*   `inputSchema: ZodSchema<TInput>` (Required): Zod schema for validating the input object.
*   `outputSchema: ZodSchema<TOutput>` (Required): Zod schema for validating the LLM's JSON output. Also used to generate the JSON schema instructions in the default prompt.
*   `userQueryTemplate: string` (Required): Handlebars template string defining the user's specific query. Input variables are accessible via `{{variableName}}`. Use triple braces `{{{variableName}}}` for HTML-escaping prevention if needed.
*   `promptTemplate?: string` (Optional): Handlebars template string for the *entire* prompt sent to the LLM. If omitted, a default template is used which includes system instructions, JSON schema derived from `outputSchema`, and the rendered `userQueryTemplate`. Key variables available: `{{{userQuery}}}` and `{{{jsonSchema}}}` (the generated schema string, or `null`).
*   `outputParser?: OutputParser<TOutput>` (Optional): A custom parser object to transform the raw LLM output string into the desired `TOutput` structure *before* Zod validation. Defaults to an internal JSON parser that extracts JSON from potential markdown fences or surrounding text.
*   `retryOptions?: RetryOptions` (Optional): Configuration for retrying the LLM call on failure.
    *   `maxAttempts?: number` (Default: 3)
    *   `delayMs?: number | ((attempt: number) => number)` (Default: 200ms fixed)
    *   `condition?: (error: Error) => boolean` (Default: Retries on `LLMError`, `OutputParsingError`, `OutputValidationError`. See `src/core/retry-options.ts` for details).
*   `llmOptions?: Record<string, unknown>` (Optional): An object containing options passed directly to the `llmProvider.generate` method (e.g., `temperature`, `max_tokens`, `model`).
*   `functionId?: string` (Optional): A unique identifier for this function, used in events for tracing.
*   `cacheOptions?: { enabled?: boolean; ttl?: number }` (Optional): Configures caching behavior.
    *   `enabled?: boolean` (Default: false)
    *   `ttl?: number` (Optional): Cache Time-To-Live in milliseconds. If omitted, uses the `CacheProvider`'s default TTL or caches indefinitely. Requires a `CacheProvider` in the `ExecutionContext`.

### `ExecutionContext`

An interface defining the dependencies required during function execution.

*   `llmProvider: LLMProvider` (Required): An instance conforming to the `LLMProvider` interface to handle communication with the LLM.
*   `eventHandler?: EventHandler` (Optional): An instance conforming to the `EventHandler` interface to receive execution events.
*   `cacheProvider?: CacheProvider` (Optional): An instance conforming to the `CacheProvider` interface. Required if `cacheOptions.enabled` is true in the function definition.

### `LLMProvider`

Interface for abstracting LLM API interactions. You need to implement this for your specific LLM service.

*   `generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>`: Sends the prompt and returns the raw output and optional metadata.
    *   `LLMGenerateOptions`: Can include `llmOptions`