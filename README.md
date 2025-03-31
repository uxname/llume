# LLume JS

[![npm version](https://badge.fury.io/js/llume-js.svg)](https://badge.fury.io/js/llume-js)
[![License](https://img.shields.io/npm/l/llume-js.svg)](./LICENSE)

**LLume JS** is a framework for Node.js that allows you to create AI agents capable of performing tasks by interacting
with Large Language Models (LLMs) and using external tools.

## The Problem It Solves

This framework simplifies the creation of complex workflows where AI needs not only to generate text or answer questions
but also to interact with external APIs, databases, or perform other specific actions through predefined "tools". It
automates the "request -> LLM -> tool call -> LLM -> result" cycle, managing state, history, and the processing of LLM
responses.

## Key Features

* **LLM Integration:** Flexible system for connecting various LLM providers.
* **Tool Support (Tools API):** Easily define and connect your own tools (functions) that the LLM can call to retrieve
  data or perform actions.
* **Strict Typing and Validation:** Uses [Zod](https://zod.dev/) to define and validate input/output schemas for tools,
  as well as the expected format for successful LLM responses.
* **Context Management:** Supports passing conversation history, tool call history, and an arbitrary state object to the
  LLM for more contextual responses.
* **Automatic Prompt Generation:** Built-in templating engine (Handlebars) to create structured prompts for the LLM
  based on the request, available tools, history, and state.
* **Execution Loop with Tools:** Automatically handles LLM requests to call tools, executes them, and feeds the results
  back to the LLM to complete the task.

## Table of Contents

* [Installation](#installation)
* [Usage](#usage)
    * [1. Define Tools](#1-define-tools)
    * [2. Define the Success Response Schema](#2-define-the-success-response-schema)
    * [3. Setup the LLM Provider](#3-setup-the-llm-provider)
    * [4. Create the Request and Pipeline](#4-create-the-request-and-pipeline)
    * [5. Run the Executor](#5-run-the-executor)
* [API](#api)
    * [`Executor`](#executor)
    * [`LlmRequest`](#llmrequest)
    * [`BaseTool`](#basetool)
    * [`Ai0LlmProvider`](#ai0llmprovider)
    * [`Pipeline`](#pipeline)
* [Configuration](#configuration)
* [Testing](#testing)
* [Contributing](#contributing)
* [License](#license)

## Installation

```bash
npm install llume-js
# or
yarn add llume-js
# or
bun add llume-js
```

## Usage

Here is a minimal example demonstrating the basic workflow: querying an LLM that uses a tool to generate a random
number.

```javascript
// main.js
require('dotenv').config(); // Load environment variables from .env
const { z } = require('zod');
const { Executor, LlmRequest, BaseTool, Pipeline, Ai0LlmProvider } = require('llume-js');

// --- 1. Define Tools ---
// A tool to generate a random number
class RandomNumberTool extends BaseTool {
  name = "RandomNumberGenerator";
  description = "Generates a random integer within a specified range (inclusive).";
  inputSchema = z.object({
    min: z.number().int().describe("The minimum value"),
    max: z.number().int().describe("The maximum value"),
  });
  outputSchema = z.object({
    randomNumber: z.number().int().describe("The generated random number"),
  });

  async execute(input) {
    // Input validation isn't strictly necessary here as the Executor can handle it,
    // but it can be useful for explicit checks.
    console.log(`[Tool] Called ${this.name} with input:`, input);
    const randomNumber = Math.floor(Math.random() * (input.max - input.min + 1)) + input.min;
    console.log(`[Tool] ${this.name} returning:`, { randomNumber });
    return { randomNumber };
  }
}

// --- 2. Define the Success Response Schema ---
// What we expect the LLM to return in the end
const successSchema = z.object({
  message: z.string().describe("A message for the user, including the random number."),
  generatedNumber: z.number().int().describe("The random number that was generated."),
});

// --- 3. Setup the LLM Provider ---
// Use the built-in AI0 provider
const llmProvider = new Ai0LlmProvider(
  process.env.AI0_URL,
  process.env.AI0_API_KEY,
);

// --- 4. Create the Request and Pipeline ---
const userQuery = "Generate a random number between 1 and 100 and tell me what it is.";
const tools = [new RandomNumberTool()];

const request = new LlmRequest(
  userQuery,
  successSchema, // Schema for the final LLM response
  tools,         // Available tools
  // Optionally add initial state, conversation history, or tool call history if needed
  // state: { userId: 'user-123' },
  // history: [{ role: 'user', content: 'Hi!' }, { role: 'assistant', content: 'How can I help?' }],
);

// The Pipeline tracks the execution steps
const pipeline = new Pipeline(request);

// --- 5. Run the Executor ---
const executor = new Executor(llmProvider);

async function run() {
  try {
    console.log("Starting Executor...");
    // The result type will be inferred from successSchema: z.infer<typeof successSchema>
    const result = await executor.execute(pipeline);

    console.log("\n✅ Success Result:");
    console.log(result);

  } catch (error) {
    console.error("\n❌ Execution Error:", error);
  }

  // You can inspect the execution history within the pipeline
  // console.log('\n📜 Pipeline Execution History:');
  // console.log(JSON.stringify(pipeline.executions, null, 2));
}

run();
```

**Execution Flow Example:**

1. The `Executor` receives the `pipeline` with the initial `LlmRequest`.
2. The `Executor` compiles a prompt for the LLM, including the description of `RandomNumberTool` and the response
   schema.
3. The `Executor` sends the prompt to the `Ai0LlmProvider`.
4. The LLM responds with a JSON object indicating the need to call `RandomNumberGenerator` with parameters
   `{ min: 1, max: 100 }`.
5. The `Executor` parses the response and finds the `RandomNumberTool`.
6. The `Executor` calls `tool.execute({ min: 1, max: 100 })`.
7. The tool returns `{ randomNumber: <some_number> }`.
8. The `Executor` updates the `pipeline`, adding the tool call result to the `toolsCallHistory`.
9. The `Executor` compiles a new prompt, now including the result of the tool call.
10. The `Executor` sends the new prompt to the `Ai0LlmProvider`.
11. The LLM, having the tool's result, generates the final response matching the `successSchema`.
12. The `Executor` parses the successful response and returns its data (`result.data`).

## API

The main components exported by the package:

### `Executor`

The class responsible for orchestrating the entire interaction process with the LLM and tools.

* **`constructor(llm: BaseLlmProvider)`**: Accepts an instance of an LLM provider.
* **`async execute<TData>(pipeline: Pipeline): Promise<TData>`**: Starts the execution process.
    * Takes a `Pipeline` containing an `LlmRequest`.
    * Manages the loop of LLM calls and tool executions.
    * Returns a Promise resolving with the result of type `TData` (matching the `successResponseSchema` from
      `LlmRequest`) or throws an error.

### `LlmRequest`

A container class for all data needed for one interaction cycle with the LLM.

* **
  `constructor(userQuery: string, successResponseSchema: z.ZodType, tools?: BaseTool[], state?: any, history?: Message[], toolsCallHistory?: ToolCallResult[])`
  **:
    * `userQuery`: The primary user request (string).
    * `successResponseSchema`: A Zod schema for validating and typing the final successful LLM response.
    * `tools` (optional): An array of `BaseTool` instances available for the LLM to call.
    * `state` (optional): An arbitrary state object passed to the LLM.
    * `history` (optional): An array of messages (`{ role: Role, content: string }`) to provide conversation history.
      `Role` can be `USER`, `ASSISTANT`, `SYSTEM`.
    * `toolsCallHistory` (optional): An array of results from previous tool calls (
      `{ toolName: string, toolInput: any, toolOutput: any }`). The `Executor` automatically populates this history
      during execution.

### `BaseTool`

An abstract class that you must extend to create your own tools.

* **`abstract readonly name: string`**: A unique name for the tool.
* **`abstract readonly description: string`**: A description of the tool that will be passed to the LLM.
* **`abstract readonly inputSchema: z.ZodSchema`**: A Zod schema to validate the tool's input data.
* **`abstract readonly outputSchema: z.ZodSchema`**: A Zod schema to validate the tool's output data.
* **`abstract execute(input: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>>`**: An
  asynchronous method containing the tool's logic. It receives validated input data and returns a Promise resolving with
  a result matching the `outputSchema`.

### `Ai0LlmProvider`

A concrete implementation of `BaseLlmProvider` for interacting with the `ai0.uxna.me` API.

* **`constructor(baseUrl: string, apiKey: string, defaultProvider: string = "gemini", requestTimeout: number = 60000)`
  **:
    * `baseUrl`: The URL of the AI0 endpoint (e.g., `process.env.AI0_URL`).
    * `apiKey`: Your AI0 API key (e.g., `process.env.AI0_API_KEY`).
    * `defaultProvider` (optional): The name of the underlying LLM provider in AI0 (defaults to 'gemini').
    * `requestTimeout` (optional): Request timeout in milliseconds (defaults to 60000).
* **`async execute(prompt: string): Promise<string>`**: Sends the prompt to the API and returns the LLM's raw text
  response (expected to be JSON).

### `Pipeline`

A class for tracking the state and execution history within a single `executor.execute` call.

* **`constructor(request: LlmRequest)`**: Initializes the pipeline with the starting request.
* **`llmRequest: LlmRequest`**: The current state of the request (including updated tool call history).
* **`executions: Execution[]`**: An array recording each execution step (LLM or tool call). Each `Execution` record
  contains `executionDate`, `requestTarget` (LLM or TOOL), `toolName` (if applicable), `input`, and `response`.
* **`addExecution(...)`**: An internal method (called by `Executor`) to add an execution step record.

## Configuration

The primary ways to configure the package are:

1. **Passing Parameters to Constructors:** E.g., `Ai0LlmProvider` requires `baseUrl` and `apiKey`.
2. **Environment Variables:** It's recommended to store sensitive data (API keys, URLs) in environment variables and
   load them using `dotenv`. The `Ai0LlmProvider` expects `AI0_URL` and `AI0_API_KEY`.
3. **Defining Tools:** You define the set of available tools by passing an array of `BaseTool` instances to the
   `LlmRequest`.
4. **Defining Schemas:** You define Zod schemas for tool inputs/outputs and for the expected final LLM response.

## Testing

To run the tests, use the command:

```bash
npm test
# or if using bun
bun test
```

Tests use `vitest` and require a `.env` file with valid `AI0_URL` and `AI0_API_KEY` for integration tests involving the
LLM.

## Contributing

Contributions from the community are welcome! If you'd like to contribute, please follow these steps:

1. Fork the repository on GitHub.
2. Create a new branch for your feature or fix (`git checkout -b feature/my-new-feature` or
   `git checkout -b fix/bug-fix`).
3. Make your changes. Write tests for new functionality.
4. Ensure all tests pass (`npm test`).
5. Follow the project's code style (use `npm run lint` or `bun run lint`).
6. Create a Pull Request against the main repository branch.

Please report bugs and suggest features through the GitHub Issues section of the repository.

A more detailed `CONTRIBUTING.md` file may be created later for specific guidelines.

## License

This project is licensed under the **MIT** License. See the [LICENSE](./LICENSE) file for details.
This means you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
software, provided that the original copyright notice and this permission notice are included in all copies or
substantial portions of the software.
