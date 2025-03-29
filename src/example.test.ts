import { describe, expect, test } from "vitest";
import { Executor } from "./core/executor.ts";
import { StatelessFunction } from "./core/core/stateless-function.ts";
import { z } from "zod";
import { PromptTemplate } from "./core/core/prompt-template.ts";
import { Tool } from "./core/core/tool.ts";
import { Ai0 } from "./core/llms/ai0.ts";
import pc from "picocolors";

describe("example", () => {
  test("should calculate", async () => {
    const llm = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const inputSchema = z.object({
      expression: z.string(),
    });
    const outputSchema = z.object({
      result: z.number(),
    });

    type Input = z.infer<typeof inputSchema>;
    type Output = z.infer<typeof outputSchema>;

    class Calculator extends StatelessFunction {
      public llm = llm;
      public name = "Calculator";
      public description = "True calculator that calculates any expressions";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Without tools calculate next expression: {{expression}}`,
      );
    }

    const calculator = new Calculator();
    const executor = new Executor();
    executor.addFunction(calculator);

    const result = await executor.smartExecute<Input, Output>(calculator.name, {
      expression: "2 / 2",
    });

    expect(result.result).toBe(1);
  });

  test("should tell weather", async () => {
    const llm = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);

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
      public execute = async (input: ToolInput) => {
        const degree = Math.floor(Math.random() * 10);
        return {
          result: degree,
          humanReadable: `${degree} degrees Celcius in ${input.city}`,
        };
      };
    }

    class Weather extends StatelessFunction {
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

  test("should retry product search and find relevant products after 4 attempts", async () => {
    const llm = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const inputSchema = z.object({
      query: z.string().describe("Search query for products"),
    });

    const toolInputSchema = z.object({
      query: z.string().describe("Product search query"),
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
      private irrelevantProducts = Array.from({ length: 16 }, (_, i) => ({
        name: `Товар ${i + 1}`,
        price: Math.floor(Math.random() * 100) + 10,
        description: "Нерелевантный товар",
      }));

      private relevantProducts = [
        {
          name: "Красные кроссовки Nike",
          price: 149.99,
          description: "Красные кроссовки с амортизацией",
        },
        {
          name: "Красные кроссовки Adidas",
          price: 129.99,
          description: "Легкие красные кроссовки для бега",
        },
        {
          name: "Кеды красные Puma",
          price: 99.99,
          description: "Модные красные кеды",
        },
        {
          name: "Кроссовки Reebok синие",
          price: 109.99,
          description: "Клёвые кроссовки с поддержкой стопы",
        },
      ];

      public execute = async (input: ToolInput) => {
        this.attemptCount++;

        if (this.attemptCount <= 4) {
          // Возвращаем случайные 3 нерелевантных товара
          const shuffled = this.irrelevantProducts.sort(
            () => 0.5 - Math.random(),
          );
          return { products: shuffled.slice(0, 3) };
        }

        // С 5-й попытки возвращаем релевантные товары
        return { products: this.relevantProducts };
      };
    }

    class ProductSearch extends StatelessFunction {
      public llm = llm;
      public name = "ProductSearch";
      public description = "Search products by query with retry";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;

      async preRunMiddleware(input: Input) {
        console.log(
          pc.blue("(Pre run middleware): " + JSON.stringify(input, null, 2)),
        );
      }

      async postRunMiddleware(output: OutputFunction) {
        console.log(
          pc.green("(Post run middleware): " + JSON.stringify(output, null, 2)),
        );
      }

      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Найди товары по запросу: "{{query}}". 
      Если не найдено, попробуй расширить поиск.
      Сделай как минимум 10 попыток.
      Нужно максимально точно находить нужные товары.
      Выведи результаты с названием, ценой и описанием на русском`,
      );

      public tools = [new ProductSearchTool()];
    }

    const productSearch = new ProductSearch();
    const executor = new Executor();
    executor.addFunction(productSearch);

    const finalResult = await executor.smartExecute<Input, OutputFunction>(
      productSearch.name,
      { query: "синие кроссовки" },
    );

    console.log(JSON.stringify(finalResult, null, 2));
  });
});
