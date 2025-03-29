import { describe, expect, test } from "vitest";
import { Executor } from "./core/executor.ts";
import { AiFunction } from "./core/ai-function.ts";
import { z } from "zod";
import { PromptTemplate } from "./core/prompt-template.ts";
import { Tool } from "./core/tool.ts";
import { Ai0Llm } from "./core/llm-providers/ai0-llm.ts";
import pc from "picocolors";
import type { MiddlewareEvent } from "./core/prompt/schemas.ts";

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
          const eventTypeColors = {
            llm_request: pc.blue,
            llm_response: pc.green,
            tool_request: pc.yellow,
            tool_response: pc.magenta,
          };

          const colorFn = eventTypeColors[event.type] || pc.white;
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
    expect(events.some((e) => e.type === "llm_request")).toBe(true);
    expect(events.some((e) => e.type === "llm_response")).toBe(true);
    expect(events.some((e) => e.type === "tool_request")).toBe(true);
    expect(events.some((e) => e.type === "tool_response")).toBe(true);

    // Expect the result to be returned successfully
    expect(finalResult).toBeDefined();
    expect(Array.isArray(finalResult)).toBe(true);
  });
});
