import { describe, expect, test } from "vitest";
import { Executor } from "./core/executor.ts";
import { StatelessFunction } from "./core/base-classes/stateless-function.ts";
import { LLM } from "./core/base-classes/llm.ts";
import { z } from "zod";
import { PromptTemplate } from "./core/base-classes/prompt-template.ts";
import { Tool } from "./core/base-classes/tool.ts";

describe("example", () => {
  test("should calculate", () => {
    class FakeLLm extends LLM {
      name = "FakeLLM";

      async execute(prompt: string): Promise<string> {
        // console.log("FakeLLM request:", prompt);
        return '{"type": "success", "_data": {"number": 123, "string": "hello"}}';
      }
    }

    const fakeLlm = new FakeLLm();

    const inputSchema = z.object({
      expression: z.string(),
    });
    const outputSchema = z.object({
      result: z.number(),
    });

    type Input = z.infer<typeof inputSchema>;
    type Output = z.infer<typeof outputSchema>;

    class Calculator extends StatelessFunction {
      public llm = fakeLlm;
      public name = "Calculator";
      public description = "True calculator that calculates any expressions";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Calculate next expression: {{expression}}`,
      );
    }

    const calculator = new Calculator();
    const executor = new Executor();
    executor.addFunction(calculator);

    executor.smartExecute<Input, Output>(calculator.name, {
      expression: "2 / 2",
    });

    expect(executor).toBeDefined();
  });

  test("should tell weather", async () => {
    class FakeLLm extends LLM {
      name = "FakeLLM";
      isFirstRun = true;

      async execute(prompt: string): Promise<string> {
        // console.log("FakeLLM request:", prompt);
        // console.log({ callTool });
        if (this.isFirstRun) {
          this.isFirstRun = false;
          return '{"_type": "call_tool", "_toolName": "Weather", "_input": {"city": "Minsk"}}';
        }

        return '{"_type": "success", "_data": {"result": 9, "humanReadable": "In Minsk it is 9 degrees Celcius"}}';
      }
    }

    const fakeLlm = new FakeLLm();

    const inputSchema = z.object({
      city: z.string(),
    });
    const outputSchema = z.object({
      result: z.number().describe("Degrees Celcius"),
      humanReadable: z.string().describe("Human readable result"),
    });

    type Input = z.infer<typeof inputSchema>;
    type Output = z.infer<typeof outputSchema>;

    class WeatherTool extends Tool {
      public name = "Weather";
      public description = "Tell weather for city";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public execute = async (input: Input) => {
        // console.log('Tool "Weather" request:', input);
        return {
          result: 9,
          humanReadable: "9 degrees Celcius",
        };
      };
    }

    class Weather extends StatelessFunction {
      public llm = fakeLlm;
      public name = "Weather";
      public description = "Tell weather for city";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Tell weather for city: {{city}}`,
      );
      public tools = [new WeatherTool()];
    }

    const weather = new Weather();
    const executor = new Executor();
    executor.addFunction(weather);

    const result = await executor.smartExecute<Input, Output>(weather.name, {
      city: "Minsk",
    });

    console.log(result);

    expect(executor).toBeDefined();
  });
});
