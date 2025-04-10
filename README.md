# LLume

[![npm version](https://badge.fury.io/js/llume.svg)](https://badge.fury.io/js/llume)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Git Repository](https://img.shields.io/badge/repo-GitHub-blue.svg)](https://github.com/uxname/llume)

**LLume** is a lightweight, type-safe Node.js framework designed to streamline the creation and execution of structured, predictable interactions with Large Language Models (LLMs). It emphasizes developer experience through strong typing, clear abstractions, and built-in utilities for common LLM workflow patterns.

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
*   🔄 **LLM Agnostic:** Designed to work with any LLM through a simple `LLMProvider` interface.
*   🔁 **Automatic Retries:** Built-in, configurable retry logic for handling transient LLM API errors or output parsing/validation failures.
*   ⚡ **Caching:** Optional caching layer (via `CachingLLMProvider` and `CacheProvider` interface, with `InMemoryCacheProvider` included) to reduce latency and costs.
*   📢 **Event System:** Emits detailed `ExecutionEvent`s throughout the function lifecycle (validation, prompting, LLM calls, parsing, caching, retries) for robust tracing, logging, and monitoring via an `EventHandler` interface.
*   🧩 **Clean API:** A straightforward factory function (`createAiFunction`) simplifies the creation and execution of LLM tasks.
*   🚫 **Error Handling:** Provides specific error classes (`InputValidationError`, `OutputParsingError`, `LLMError`, etc.) for easier error management.

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
    *   `LLMGenerateOptions`: Can include `llmOptions` (passed from definition) and `publishEvent` (internal function for event emission, mainly used by `CachingLLMProvider`).
    *   `LLMResponse`: Object containing `rawOutput: string`, optional `usage` tokens, and optional `modelInfo`.

### `CacheProvider` / `InMemoryCacheProvider`

Interface for caching LLM responses to avoid redundant API calls.

*   `get<T>(key: string): Promise<T | undefined>`
*   `set<T>(key: string, value: T, ttl?: number): Promise<void>`
*   `delete(key: string): Promise<void>`
*   `clear(): Promise<void>`

LLume provides a basic `InMemoryCacheProvider` implementation suitable for single-process applications.

### `EventHandler`

Interface for subscribing to events during the `AiFunction` lifecycle.

*   `publish(event: ExecutionEvent): Promise<void> | void`: Receives event objects.
*   `ExecutionEvent`: Contains `type: ExecutionEventType`, `timestamp`, `functionId?`, and `data` specific to the event (e.g., input, output, error, prompt, cache key). See `ExecutionEventType` enum in `src/events/execution-event.ts` for all event types.

### Error Classes

LLume throws specific error types inheriting from `AiFunctionError`:

*   `InputValidationError`: Input failed Zod validation. Contains `validationErrors`.
*   `PromptCompilationError`: Handlebars template compilation failed (either at creation or runtime). Contains `originalError`.
*   `LLMError`: Error during communication with the `LLMProvider`. Contains `providerDetails`.
*   `OutputParsingError`: Failed to parse the LLM's `rawOutput` (e.g., invalid JSON). Contains `rawOutput` and `originalError`.
*   `OutputValidationError`: Parsed output failed Zod validation against `outputSchema`. Contains `parsedOutput` and `validationErrors`.
*   `MissingContextError`: Required provider (e.g., `llmProvider`) was missing from the context.
*   `MaxRetriesExceededError`: The operation failed after the maximum number of retry attempts. Contains `lastError` and `attempts`.

## Advanced Usage

### Custom Prompt Structure

If the default prompt template doesn't suit your needs (e.g., you need ChatML format or specific system instructions), provide a custom `promptTemplate` in the `AiFunctionDefinition`. Remember to include placeholders for the user query and optionally the JSON schema:

```typescript
const definition: AiFunctionDefinition<MyInput, MyOutput> = {
  // ... inputSchema, outputSchema ...
  userQueryTemplate: "Translate '{{englishText}}' to {{targetLanguage}}.",
  // Example for a ChatML-like model
  promptTemplate: `<|system|>You are a translation assistant. Provide ONLY the JSON response matching the schema. JSON Schema: {{{jsonSchema}}}<|end|>
<|user|>{{{userQuery}}}<|end|>
<|assistant|>`, // LLM starts generation here
};
```

### Caching LLM Responses

To enable caching:
1.  Set `cacheOptions: { enabled: true, ttl?: number }` in your `AiFunctionDefinition`.
2.  Provide an implementation of `CacheProvider` (like the built-in `InMemoryCacheProvider`) in the `ExecutionContext`.

```typescript
import { InMemoryCacheProvider } from "llume";

const definition: AiFunctionDefinition<...> = {
  // ... schemas, templates ...
  functionId: "cachableTranslator",
  cacheOptions: { enabled: true, ttl: 3600000 }, // Cache results for 1 hour
};

const context: ExecutionContext = {
  llmProvider: new MyActualLLMProvider(),
  // Provide a cache provider instance
  cacheProvider: new InMemoryCacheProvider({ maxSize: 500 }),
};

const translateCached = createAiFunction(definition, context);

// First call: Fetches from LLM, stores in cache
const result1 = await translateCached({ englishText: "hello", targetLanguage: "Spanish" });

// Second call with identical input: Fetches from cache (much faster, no LLM cost)
const result2 = await translateCached({ englishText: "hello", targetLanguage: "Spanish" });
// result1 and result2 will be identical
```
The cache key is generated based on the final prompt string and any `llmOptions` provided.

### Monitoring with Events

Implement the `EventHandler` interface to gain insights into the execution flow, log performance, or debug issues.

```typescript
import { type EventHandler, type ExecutionEvent, ExecutionEventType } from "llume";

class MyMonitoringEventHandler implements EventHandler {
  publish(event: ExecutionEvent): void {
    const { type, functionId, timestamp, data } = event;
    console.log(`[${new Date(timestamp).toISOString()}] [${functionId ?? 'unknown'}] Event: ${type}`);

    switch (type) {
      case ExecutionEventType.AI_FUNCTION_START:
        console.log("Input:", data.input);
        break;
      case ExecutionEventType.LLM_START:
        // Maybe log truncated prompt for brevity
        console.log("LLM Call Start. Prompt (start):", data.compiledPrompt?.substring(0, 100) + "...");
        break;
      case ExecutionEventType.LLM_END:
        console.log("LLM Call End. Tokens:", data.response?.usage);
        break;
      case ExecutionEventType.AI_FUNCTION_END:
        if (data.error) {
          console.error("Function ended with error:", data.error.name, data.error.message);
        } else {
          console.log("Output:", data.output);
        }
        break;
      // Handle other events like CACHE_HIT, RETRY_ATTEMPT, etc.
      default:
        // console.log("Data:", JSON.stringify(data)); // Can be verbose
        break;
    }
  }
}

const context: ExecutionContext = {
  llmProvider: new MyLLMProvider(),
  eventHandler: new MyMonitoringEventHandler(), // Add the handler
};

const myFunction = createAiFunction(myDefinition, context);
// Now events will be sent to MyMonitoringEventHandler during execution
```

## Technology Stack

*   **Language:** TypeScript
*   **Runtime:** Node.js (uses `bun` for development)
*   **Schema Validation:** Zod
*   **Prompt Templating:** Handlebars
*   **Testing:** Vitest
*   **Linting/Formatting:** Biome

## Development & Testing

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/uxname/llume.git
    cd llume
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    ```
3.  **Setup Environment (for integration tests):**
    Copy the example environment file and fill in your credentials (e.g., for the `Ai0Provider` used in tests):
    ```bash
    cp .env_example .env
    # Edit .env with your actual API key and URL
    ```
4.  **Run Checks (Lint, Format, Types):**
    ```bash
    bun run check
    ```
5.  **Run Tests:**
    ```bash
    bun test
    # Or run in watch mode
    bun run test:watch
    ```
6.  **Build:**
    ```bash
    bun run build
    ```

## Contributing

Contributions are welcome! Please feel free to open an issue to discuss bugs or feature ideas, or submit a pull request.

1.  Fork the repository (`https://github.com/uxname/llume/fork`).
2.  Create your feature branch (`git checkout -b feature/my-new-feature`).
3.  Commit your changes (`git commit -am 'Add some feature'`).
4.  Ensure checks and tests pass (`bun run check && bun test`).
5.  Push to the branch (`git push origin feature/my-new-feature`).
6.  Create a new Pull Request.

## License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.
