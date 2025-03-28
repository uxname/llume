import { describe, expect, test } from "vitest";
import { Executor } from "./core/executor.ts";
import { StatelessFunction } from "./core/core/stateless-function.ts";
import { z } from "zod";
import { PromptTemplate } from "./core/core/prompt-template.ts";
import { Tool } from "./core/core/tool.ts";
import { Ai0 } from "./core/llms/ai0.ts";

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
});
