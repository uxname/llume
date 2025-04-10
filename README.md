# LLume

[![npm version](https://badge.fury.io/js/llume.svg)](https://badge.fury.io/js/llume)
[![License](https://img.shields.io/npm/l/llume.svg)](./LICENSE)

**LLume** is a lightweight, type-safe Node.js framework for creating and executing structured interactions with Large Language Models (LLMs). It focuses on simplifying prompt management, input/output validation, error handling, and retries.

## Core Concept: `AiFunction`

The central piece of LLume is the `AiFunction`. It encapsulates a specific task you want an LLM to perform, defined by:

*   **Input Schema (Zod):** Defines the expected input data structure.
*   **Output Schema (Zod):** Defines the expected JSON output structure from the LLM.
*   **Prompt Templates (Handlebars):**
    *   `userQueryTemplate`: Defines the specific user request using input variables.
    *   `promptTemplate` (Optional): Defines the overall structure of the prompt sent to the LLM, incorporating the user query and potentially system instructions. Uses a default template with JSON schema instructions if omitted.
*   **LLM Provider:** An interface to interact with any LLM API.
*   **Configuration:** Options for retries, caching, LLM parameters, etc.

## Features

*   **Type Safety:** Uses [Zod](https://zod.dev/) for robust input and output validation.
*   **Structured Output:** Enforces JSON output based on your Zod schema by default.
*   **Flexible Prompting:** Uses [Handlebars](https://handlebarsjs.com/) for templating, allowing full control over the final prompt structure.
*   **LLM Agnostic:** Works with any LLM via the `LLMProvider` interface.
*   **Automatic Retries:** Configurable retry logic for transient LLM or parsing errors.
*   **Caching:** Optional caching layer (`CachingLLMProvider`, `InMemoryCacheProvider`) to save costs and speed up responses.
*   **Event System:** Publishes events (`ExecutionEvent`) for tracing and monitoring function execution steps.
*   **Clean API:** Simple `createAiFunction` factory and execution flow.

## Installation

```bash
npm install llume zod handlebars zod-to-json-schema
# or
yarn add llume zod handlebars zod-to-json-schema
# or
bun add llume zod handlebars zod-to-json-schema
```

## Quick Start Example

```typescript
import { z } from "zod";
import {
	createAiFunction,
	type ExecutionContext,
	type AiFunctionDefinition,
	// Replace with your actual LLM provider implementation
	// import { YourLLMProvider } from "./your-llm-provider";
} from "llume";

// Mock provider for example purposes
class MockLLMProvider implements LLMProvider {
	async generate(prompt: string, options?: any): Promise<LLMResponse> {
		console.log("--- Mock LLM Received Prompt ---\n", prompt);
		// Simulate LLM response based on prompt content
		if (prompt.includes("sentiment")) {
			return { rawOutput: JSON.stringify({ sentiment: "positive", confidence: 0.9 }) };
		}
		return { rawOutput: JSON.stringify({ error: "Unknown request" }) };
	}
}


// 1. Define Input/Output Schemas
const SentimentInputSchema = z.object({
	inputText: z.string(),
});
type SentimentInput = z.infer<typeof SentimentInputSchema>;

const SentimentOutputSchema = z.object({
	sentiment: z.enum(["positive", "negative", "neutral"]),
	confidence: z.number().min(0).max(1),
});
type SentimentOutput = z.infer<typeof SentimentOutputSchema>;

// 2. Define the AI Function
const analyzeSentimentDefinition: AiFunctionDefinition<
	SentimentInput,
	SentimentOutput
> = {
	functionId: "sentimentAnalyzer",
	inputSchema: SentimentInputSchema,
	outputSchema: SentimentOutputSchema,
	// userQueryTemplate is mandatory
	userQueryTemplate: "Analyze the sentiment of the text: {{{inputText}}}",
	// promptTemplate is optional, uses default with JSON instructions if omitted
};

// 3. Prepare Execution Context
const executionContext: ExecutionContext = {
	llmProvider: new MockLLMProvider(),
	// eventHandler: new MyEventHandler(), // Optional
	// cacheProvider: new InMemoryCacheProvider(), // Optional
};

// 4. Create the Executable Function
const analyzeSentiment = createAiFunction(analyzeSentimentDefinition, executionContext);

// 5. Execute
async function run() {
	try {
		const input: SentimentInput = {
			inputText: "LLume makes working with LLMs so much easier!",
		};
		const result = await analyzeSentiment(input);
		console.log("Sentiment:", result); // Output: { sentiment: 'positive', confidence: 0.9 }
	} catch (error) {
		console.error("Error:", error);
	}
}

run();
```

## API Overview

### `createAiFunction(definition, defaultContext?)`

Factory function to create an executable AI function.

*   `definition: AiFunctionDefinition<TInput, TOutput>`: The core definition object.
    *   `inputSchema: ZodSchema<TInput>`
    *   `outputSchema: ZodSchema<TOutput>`
    *   `userQueryTemplate: string` (Handlebars template for the user query)
    *   `promptTemplate?: string` (Optional Handlebars template for the full prompt structure, defaults to one including JSON instructions and `{{{userQuery}}}`)
    *   `outputParser?: OutputParser<TOutput>` (Optional custom output parser)
    *   `retryOptions?: RetryOptions`
    *   `llmOptions?: Record<string, unknown>` (Options passed directly to `llmProvider.generate`)
    *   `functionId?: string` (Identifier for logging/events)
    *   `cacheOptions?: { enabled?: boolean; ttl?: number }`
*   `defaultContext?: ExecutionContext`: Default context to use if not provided at runtime.

Returns `AiFunctionExecutable<TInput, TOutput>`, which is an async function `(input: TInput, runtimeContext?: ExecutionContext) => Promise<TOutput>`.

### `ExecutionContext`

An interface for providing dependencies during execution.

*   `llmProvider: LLMProvider` (Required)
*   `eventHandler?: EventHandler` (Optional)
*   `cacheProvider?: CacheProvider` (Optional, needed if `cacheOptions.enabled` is true)

### `LLMProvider`

Interface for LLM interaction.

*   `generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>`

### `OutputParser<TOutput>`

Interface for custom output parsing.

*   `parse(rawOutput: string): Promise<TOutput> | TOutput`

### `CacheProvider`

Interface for caching LLM responses.

*   `get<T>(key: string): Promise<T | undefined>`
*   `set<T>(key: string, value: T, ttl?: number): Promise<void>`
*   `delete(key: string): Promise<void>`
*   `clear(): Promise<void>`

### `InMemoryCacheProvider`

A basic in-memory implementation of `CacheProvider`.

### Error Classes

Custom errors like `InputValidationError`, `OutputParsingError`, `OutputValidationError`, `LLMError`, `MaxRetriesExceededError` provide specific details about failures.

## Advanced Usage

### Custom Prompt Structure

Provide your own `promptTemplate` to control the exact format sent to the LLM (e.g., for specific model requirements like ChatML). Remember to include `{{{userQuery}}}` where the user's query should be inserted.

```typescript
const definition: AiFunctionDefinition<...> = {
  // ... schemas ...
  promptTemplate: `<|system|>Instructions... JSON Schema: {{{jsonSchema}}}<|end|>\n<|user|>{{{userQuery}}}<|end|>\n<|assistant|>`,
  userQueryTemplate: "User query part: {{inputVar}}",
};
```

### Caching

Enable caching by providing `cacheOptions` in the definition and a `CacheProvider` in the `ExecutionContext`.

```typescript
import { InMemoryCacheProvider } from "llume";

const definition: AiFunctionDefinition<...> = {
  // ... schemas, templates ...
  cacheOptions: { enabled: true, ttl: 3600000 }, // Cache for 1 hour
};

const context: ExecutionContext = {
  llmProvider: new MyLLMProvider(),
  cacheProvider: new InMemoryCacheProvider({ maxSize: 500 }),
};

const myFunction = createAiFunction(definition, context);
// Subsequent calls with the same input (and llmOptions) will hit the cache
```

## Testing

```bash
# Ensure .env file exists with necessary API keys (e.g., AI0_URL, AI0_API_KEY for tests)
cp .env_example .env
# Fill in your actual keys in .env

bun install
bun test
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/your-feature`).
3.  Make your changes.
4.  Add tests for your changes.
5.  Run checks: `bun run check` & `bun test`.
6.  Commit your changes (`git commit -am 'Add some feature'`).
7.  Push to the branch (`git push origin feature/your-feature`).
8.  Create a new Pull Request.

## License

[MIT](./LICENSE)