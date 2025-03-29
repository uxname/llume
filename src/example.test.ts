import { describe, expect, test } from "vitest";
import { Executor } from "./core/executor.ts";
import { AiFunction } from "./core/ai-function.ts";
import { z } from "zod";
import { PromptTemplate } from "./core/prompt-template.ts";
import { Tool } from "./core/tool.ts";
import { Ai0Llm } from "./core/llm-providers/ai0-llm.ts";
import pc from "picocolors"; // Import Formatter type
import type { MiddlewareEvent } from "./core/prompt/schemas.ts";
import { EventType } from "./core/prompt/schemas.ts";
import type { Formatter } from "picocolors/types"; // Import EventType

describe("example", () => {
  test("should calculate", async () => {
    const llm = new Ai0Llm(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const inputSchema = z.object({
      expression: z.string(),
    });
    const outputSchema = z.object({
      result: z.number(),
    });

    type Input = z.infer<typeof inputSchema>;
    type Output = z.infer<typeof outputSchema>;

    class Calculator extends AiFunction {
      public llm = llm;
      public name = "Calculator";
      public description = "True calculator that calculates any expressions";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Calculate this expression without using any tools: {{expression}}
        Return JSON with this format:
        {
          "_type": "success",
          "_data": {
            "result": <calculation_result>
          }
        }`,
      );
    }

    const calculator = new Calculator();
    calculator.addMiddleware(async (event): Promise<void> => {
      console.log("[MIDDLEWARE]", event);
    });
    const executor = new Executor();
    executor.addFunction(calculator);

    const result = await executor.smartExecute<Input, Output>(calculator.name, {
      expression: "2 / 2",
    });

    expect(result.result).toBe(1);
  });

  test("should tell weather", async () => {
    const llm = new Ai0Llm(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const inputSchema = z.object({
      cities: z.string(),
    });

    const toolInputSchema = z.object({
      city: z.string(),
    });

    const outputToolSchema = z.object({
      result: z.number().describe("Degrees Celcius"),
      humanReadable: z.string().describe("Human readable result"),
    });

    const outputSchema = z.array(
      z
        .object({
          city: z.string().describe("City name"),
          result: z.number().describe("Degrees Celcius"),
          humanReadable: z.string().describe("Human readable result"),
        })
        .describe("Weather info in russian language"),
    );

    type Input = z.infer<typeof inputSchema>;
    type ToolInput = z.infer<typeof toolInputSchema>;
    type OutputFunction = z.infer<typeof outputSchema>;

    class WeatherTool extends Tool {
      public name = "Weather";
      public description = "Tell weather for city";
      public inputSchema = toolInputSchema;
      public outputSchema = outputToolSchema;
      protected executeImpl = async (input: ToolInput) => {
        const degree = Math.floor(Math.random() * 10);
        return {
          result: degree,
          humanReadable: `${degree} degrees Celcius in ${input.city}`,
        };
      };
    }

    class Weather extends AiFunction {
      public llm = llm;
      public name = "Weather";
      public description = "Tell weather for city";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Узнай погоду в следующих городах: {{cities}}.
Напиши ответ только когда будет известна погода как минимум в двух городах`,
      );
      public tools = [new WeatherTool()];
    }

    const weather = new Weather();
    const executor = new Executor();
    executor.addFunction(weather);

    const result = await executor.smartExecute<Input, OutputFunction>(
      weather.name,
      {
        cities: "Minsk, New York, London, Paris, Berlin, Madrid",
      },
    );

    console.log(result);

    expect(executor).toBeDefined();
  });

  test("should capture tool and llm events with middleware", async () => {
    const llm = new Ai0Llm(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const inputSchema = z.object({
      query: z.string().describe("Search query for products"),
      limit: z.number().optional().describe("Number of products to return"),
      offset: z.number().optional().describe("Offset for pagination"),
    });

    const toolInputSchema = z.object({
      query: z.string().describe("Product search query"),
      limit: z.number().describe("Number of products to return"),
      offset: z.number().describe("Offset for pagination"),
    });

    const outputToolSchema = z.object({
      products: z.array(
        z.object({
          name: z.string().describe("Product name"),
          price: z.number().describe("Price in USD"),
          description: z.string().describe("Product description"),
        }),
      ),
    });

    const outputSchema = z.array(
      z
        .object({
          query: z.string().describe("Original search query"),
          results: z.array(
            z.object({
              name: z.string(),
              price: z.number(),
              description: z.string(),
            }),
          ),
        })
        .describe("Product search results in Russian language"),
    );

    type Input = z.infer<typeof inputSchema>;
    type ToolInput = z.infer<typeof toolInputSchema>;
    type OutputFunction = z.infer<typeof outputSchema>;

    class ProductSearchTool extends Tool {
      public name = "ProductSearch";
      public description = "Search products in database";
      public inputSchema = toolInputSchema;
      public outputSchema = outputToolSchema;

      private attemptCount = 0;
      private products = [
        {
          name: "Синие кроссовки Nike",
          price: 149.99,
          description: "Синие кроссовки с амортизацией",
        },
        {
          name: "Синие кроссовки Adidas",
          price: 129.99,
          description: "Легкие синие кроссовки для бега",
        },
        {
          name: "Кроссовки Puma синие",
          price: 99.99,
          description: "Модные синие кроссовки",
        },
      ];

      protected executeImpl = async (input: ToolInput) => {
        const { limit = 3, offset = 0 } = input; // query is not used

        // Capture middleware events but always return successful results
        return {
          products: this.products.slice(
            offset,
            Math.min(this.products.length, offset + limit),
          ),
        };
      };
    }

    class ProductSearch extends AiFunction {
      public llm = llm;
      public name = "ProductSearch";
      public description = "Search products by query with retry";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;

      constructor() {
        super();

        // Add a middleware that logs all events
        this.addMiddleware(async (event) => {
          // Explicitly type the eventTypeColors map
          const eventTypeColors: Record<EventType, Formatter> = {
            [EventType.LLM_REQUEST]: pc.blue,
            [EventType.LLM_RESPONSE]: pc.green,
            [EventType.TOOL_REQUEST]: pc.yellow,
            [EventType.TOOL_RESPONSE]: pc.magenta,
            [EventType.STATE_UPDATE]: pc.cyan, // Added color for state update
          };

          // Use the typed map, defaulting to white if somehow the type isn't found (shouldn't happen)
          const colorFn = eventTypeColors[event.type] ?? pc.white;
          console.log(
            colorFn(
              `[${event.type}] ${event.functionName || ""} ${event.toolName || ""}: ` +
                JSON.stringify(event.input || event.output, null, 2),
            ),
          );
        });
      }

      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Найди товары по запросу: "{{query}}".
      Товары должны быть по запросу "синие кроссовки".
      Нужны синие кроссовки, а не другого цвета.
      Используй инструмент ProductSearch для поиска товаров.
      Выведи результаты с названием, ценой и описанием на русском.`,
      );

      public tools = [new ProductSearchTool()];
    }

    const events: MiddlewareEvent[] = [];

    const productSearch = new ProductSearch();
    const executor = new Executor();
    executor.addFunction(productSearch);

    // Add an additional middleware to capture events
    productSearch.addMiddleware(async (event) => {
      console.log("[MIDDLEWARE]", JSON.stringify(event, null, 2));
      events.push(event);
    });

    // Find the tool instance and add middleware to it as well
    const tool = productSearch.tools?.[0];
    if (tool) {
      tool.addMiddleware(async (event) => {
        console.log(`Tool middleware event: ${event.type}`);
        events.push(event);
      });
    }

    const finalResult = await executor.smartExecute<Input, OutputFunction>(
      productSearch.name,
      { query: "синие кроссовки", limit: 2, offset: 0 },
    );

    // Verify we received the expected events
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === EventType.LLM_REQUEST)).toBe(true);
    expect(events.some((e) => e.type === EventType.LLM_RESPONSE)).toBe(true);
    expect(events.some((e) => e.type === EventType.TOOL_REQUEST)).toBe(true);
    expect(events.some((e) => e.type === EventType.TOOL_RESPONSE)).toBe(true);

    // Expect the result to be returned successfully
    expect(finalResult).toBeDefined();
    expect(Array.isArray(finalResult)).toBe(true);
  });

  test("should modify state via middleware after tool execution", async () => {
    const llm = new Ai0Llm(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const stateToolInputSchema = z.object({
      value: z.string().describe("Value to set in state"),
    });
    const stateToolOutputSchema = z.object({
      status: z.literal("success").describe("Indicates the tool ran"),
    });
    type StateToolInput = z.infer<typeof stateToolInputSchema>;

    class StateTriggerTool extends Tool<
      StateToolInput,
      z.infer<typeof stateToolOutputSchema>
    > {
      public name = "StateTrigger";
      public description = "Triggers a state update via middleware.";
      public inputSchema = stateToolInputSchema;
      public outputSchema = stateToolOutputSchema;

      constructor() {
        super();
        // Add middleware to the tool itself
        this.addMiddleware(async (event: MiddlewareEvent) => {
          if (
            event.type === EventType.TOOL_RESPONSE &&
            event.toolName === this.name
          ) {
            console.log(
              pc.cyan(
                `[TOOL MIDDLEWARE] Tool ${this.name} responded. Updating state.`,
              ),
            );
            // Access executionContext from the event
            event.executionContext.updateState({
              triggeredByTool: true,
              toolInputValue: (event.input as StateToolInput)?.value,
            });
          }
        });
      }

      protected async executeImpl(
        input: StateToolInput,
      ): Promise<z.infer<typeof stateToolOutputSchema>> {
        console.log(
          pc.yellow(
            `[TOOL EXECUTE] Running ${this.name} with input: ${input.value}`,
          ),
        );
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { status: "success" };
      }
    }

    const functionInputSchema = z.object({
      targetValue: z.string(),
    });
    const functionOutputSchema = z.object({
      message: z.string(),
      stateValue: z.any().optional(), // Include state value in final output for verification
    });
    type FunctionInput = z.infer<typeof functionInputSchema>;
    type FunctionOutput = z.infer<typeof functionOutputSchema>;

    class StateChangerFunction extends AiFunction<
      FunctionInput,
      FunctionOutput
    > {
      public llm = llm;
      public name = "StateChanger";
      public description = "Calls a tool to trigger a state change.";
      public inputSchema = functionInputSchema;
      public outputSchema = functionOutputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Call the StateTrigger tool with the value "{{targetValue}}". Then, report success and include the current 'toolInputValue' from the state.`,
      );
      public tools = [new StateTriggerTool()];

      constructor() {
        super();
        // Add middleware to the function to log state changes
        this.addMiddleware(async (event: MiddlewareEvent) => {
          if (
            event.type === EventType.LLM_RESPONSE &&
            (event.output as { _type: string })?._type === "success"
          ) {
            // Inject current state value into the final success message if needed
            // Note: This modifies the output *after* the LLM generated it based on history.
            // A better approach might be for the LLM to explicitly ask for state.
            const currentState = event.executionContext.state;
            console.log(
              pc.magenta(
                `[FUNCTION MIDDLEWARE] LLM success response. Current state: ${JSON.stringify(currentState)}`,
              ),
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((event.output as any)?._data) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (event.output as any)._data.stateValue =
                currentState.toolInputValue;
            }
          }
        });
      }
    }

    const stateChanger = new StateChangerFunction();
    const executor = new Executor();
    executor.addFunction(stateChanger);

    expect(executor.state).toEqual({}); // Initial state is empty

    const finalResult = await executor.smartExecute<
      FunctionInput,
      FunctionOutput
    >(stateChanger.name, { targetValue: "exampleStateValue123" });

    console.log("Final Result:", JSON.stringify(finalResult, null, 2));
    console.log("Final State:", JSON.stringify(executor.state, null, 2));

    // Assert that the middleware modified the state
    expect(executor.state).toHaveProperty("triggeredByTool", true);
    expect(executor.state).toHaveProperty(
      "toolInputValue",
      "exampleStateValue123",
    );

    // Assert that the final result reflects the state change (as modified by function middleware)
    expect(finalResult).toBeDefined();
    expect(finalResult.message).toBeDefined();
    expect(finalResult.stateValue).toEqual("exampleStateValue123");
  });
});
