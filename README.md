# LLume

[![npm version](https://badge.fury.io/js/llume.svg)](https://badge.fury.io/js/llume)
[![License](https://img.shields.io/npm/l/llume.svg)](./LICENSE)

**LLume** is a Node.js framework for building AI agents that leverage Large Language Models (LLMs) and external tools to perform tasks.

## Why Use LLume?

LLume simplifies workflows where AI interacts with tools like APIs or databases, automating the "request -> LLM -> tool call -> result" cycle.

## Features

- **LLM Integration**: Connect to any LLM provider.
- **Tools**: Define custom functions for LLMs to invoke.
- **Typing**: Use [Zod](https://zod.dev/) for validation.
- **Context**: Manage history, state, and tool results.
- **Prompts**: Generate structured prompts with [Handlebars](https://handlebarsjs.com/) templating.
- **Execution Loop**: Automatically handles LLM and tool interactions.

## Installation

```bash
npm install llume
```

## Main Entities

- **Executor**: Orchestrates LLM and tool interactions.
- **LlmRequest**: Defines a single interaction cycle.
- **BaseTool**: Abstract class for custom tools.
- **Pipeline**: Tracks execution state and history.
- **AiFunction**: Simplifies task execution with automatic pipeline management.

## Examples

### Example 1: Simple LLM Request

Send a basic query to an LLM.

```javascript
require('dotenv').config();
const { z } = require('zod');
const { Executor, LlmRequest, Pipeline, BaseLlmProvider } = require('llume');

class MockLlmProvider extends BaseLlmProvider {
  name = "MockLLM";
  async executeRaw(prompt) {
    return '{"type":"success","data":{"answer":"It’s sunny!"}}';
  }
}

const successSchema = z.object({ answer: z.string() });
const llmProvider = new MockLlmProvider();
const request = new LlmRequest("What’s the weather?", successSchema);
const pipeline = new Pipeline(request);
const executor = new Executor(llmProvider);

async function run() {
  const result = await executor.execute(pipeline);
  console.log(result); // { answer: "It’s sunny!" }
}

run();
```

### Example 2: Using a Tool

Generate a random number with a tool.

```javascript
require('dotenv').config();
const { z } = require('zod');
const { Executor, LlmRequest, BaseTool, Pipeline, BaseLlmProvider } = require('llume');

class MockLlmProvider extends BaseLlmProvider {
  name = "MockLLM";
  async executeRaw(prompt) {
    return '{"type":"call_tool","tool_name":"Random","tool_input":{"min":1,"max":10}}';
  }
}

class RandomTool extends BaseTool {
  name = "Random";
  description = "Generates a random number.";
  inputSchema = z.object({ min: z.number(), max: z.number() });
  outputSchema = z.object({ number: z.number() });
  async execute(input) {
    return { number: Math.floor(Math.random() * (input.max - input.min + 1)) + input.min };
  }
}

const successSchema = z.object({ message: z.string(), number: z.number() });
const llmProvider = new MockLlmProvider();
const request = new LlmRequest("Generate a number from 1 to 10.", successSchema, [new RandomTool()]);
const pipeline = new Pipeline(request);
const executor = new Executor(llmProvider);

async function run() {
  const result = await executor.execute(pipeline);
  console.log(result); // { message: "Your number: X", number: X }
}

run();
```

### Example 3: Using `AiFunction` with Variables

Simplify execution with `AiFunction` and Handlebars templating.

```javascript
require('dotenv').config();
const { z } = require('zod');
const { AiFunction, BaseLlmProvider } = require('llume');

class MockLlmProvider extends BaseLlmProvider {
  name = "MockLLM";
  async executeRaw(prompt) {
    return '{"type":"success","data":{"short":"AI","full":42}}';
  }
}

const schema = z.object({
  short: z.string().describe("Short description"),
  full: z.number().describe("Full description"),
});

const llmProvider = new MockLlmProvider();
const aiFunc = AiFunction.create({
  query: "Describe AI simply in {{language}}",
  schema: schema,
  provider: llmProvider,
});

async function run() {
  const result = await aiFunc.execute({ language: "english" });
  console.log(result); // { short: "AI", full: 42 }
}

run();
```

### Example 4: Custom LLM Provider with Axios

Create a provider that queries a real LLM API.

```javascript
require('dotenv').config();
const axios = require('axios');
const { BaseLlmProvider } = require('llume');

class CustomLlmProvider extends BaseLlmProvider {
  name = "CustomLLM";
  constructor(apiUrl, apiKey) {
    super();
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }
  async executeRaw(prompt) {
    try {
      const response = await axios.post(
        this.apiUrl,
        { prompt: prompt },
        { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
      );
      return response.data.text;
    } catch (error) {
      throw new Error(`LLM API error: ${error.message}`);
    }
  }
}

const llmProvider = new CustomLlmProvider(process.env.LLM_API_URL, process.env.LLM_API_KEY);
console.log("Provider ready!");
```

### Example 5: Combining Tools with `AiFunction`

Multiply numbers using a tool and `AiFunction`.

```javascript
require('dotenv').config();
const { z } = require('zod');
const { AiFunction, BaseTool, BaseLlmProvider } = require('llume');

class MockLlmProvider extends BaseLlmProvider {
  name = "MockLLM";
  async executeRaw(prompt) {
    return '{"type":"call_tool","tool_name":"Multiply","tool_input":{"a":5,"b":3}}';
  }
}

class MultiplyTool extends BaseTool {
  name = "Multiply";
  description = "Multiplies two numbers.";
  inputSchema = z.object({ a: z.number(), b: z.number() });
  outputSchema = z.object({ result: z.number() });
  async execute(input) {
    return { result: input.a * input.b };
  }
}

const schema = z.object({ result: z.number() });
const llmProvider = new MockLlmProvider();
const aiFunc = AiFunction.create({
  query: "Multiply 5 by 3.",
  schema: schema,
  provider: llmProvider,
  tools: [new MultiplyTool()],
});

async function run() {
  const result = await aiFunc.execute();
  console.log(result); // { result: 15 }
}

run();
```

### Example 6: Handlebars Templating

LLume uses [Handlebars](https://handlebarsjs.com/) for request templating. Here’s a simple example:

```javascript
require('dotenv').config();
const { z } = require('zod');
const { Executor, LlmRequest, Pipeline, BaseLlmProvider } = require('llume');

class MockLlmProvider extends BaseLlmProvider {
  name = "MockLLM";
  async executeRaw(prompt) {
    return '{"type":"success","data":{"greeting":"Hello, John!"}}';
  }
}

const successSchema = z.object({ greeting: z.string() });
const llmProvider = new MockLlmProvider();
const request = new LlmRequest("Say hello to {{name}}.", successSchema);
const pipeline = new Pipeline(request);
const executor = new Executor(llmProvider);

async function run() {
  const result = await executor.execute(pipeline, { name: "John" });
  console.log(result); // { greeting: "Hello, John!" }
}

run();
```

## API

### `Executor`
- **`constructor(llm: BaseLlmProvider)`**: Initializes with an LLM provider.
- **`async execute<T>(pipeline: Pipeline): Promise<T>`**: Runs the pipeline and returns the result.

### `LlmRequest`
- **`constructor(query: string, schema: z.ZodType, tools?: BaseTool[], state?: any, history?: Message[], toolsCallHistory?: ToolCallResult[])`**: Defines a request.

### `BaseTool`
- **`name: string`**: Tool identifier.
- **`description: string`**: Tool purpose.
- **`inputSchema: z.ZodSchema`**: Input validation.
- **`outputSchema: z.ZodSchema`**: Output validation.
- **`execute(input): Promise<any>`**: Tool logic.

### `BaseLlmProvider`
- **`name: string`**: Provider identifier.
- **`executeRaw(prompt: string): Promise<string>`**: Executes the LLM request.

### `AiFunction`
- **`create({ query, schema, provider, tools? })`**: Creates a function instance.
- **`execute(variables?: Record<string, string>): Promise<any>`**: Executes with optional variables.

### `Pipeline`
- **`constructor(request: LlmRequest)`**: Sets up the pipeline.
- **`llmRequest: LlmRequest`**: Current request.
- **`executions: Execution[]`**: Execution history.

## Configuration

- **Environment Variables**: Store sensitive data in `.env`.
- **Tools**: Pass an array of `BaseTool` instances to `LlmRequest` or `AiFunction`.
- **Schemas**: Define with Zod.

## Testing

```bash
npm test
```

Requires a `.env` file with credentials.

## Contributing

1. Fork the repository.
2. Create a branch (`git checkout -b feature/name`).
3. Make changes and add tests.
4. Run `npm test` and `npm run lint`.
5. Submit a Pull Request.

Report issues on GitHub.

## License

[MIT](./LICENSE)
