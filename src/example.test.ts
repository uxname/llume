import { describe, expect, test } from "vitest";
import { Executor } from "./core/executor.ts";
import { StatelessFunction } from "./core/base-classes/stateless-function.ts";
import { LLM } from "./core/base-classes/llm.ts";
import { z } from "zod";
import { PromptTemplate } from "./core/base-classes/prompt-template.ts";

describe("example", () => {
  test("should work", () => {
    class FakeLLm extends LLM {
      name = "FakeLLM";

      async execute(prompt: string): Promise<string> {
        console.log("FakeLLM request:", prompt);
        return '{"type": "success", "_data": {"number": 123, "string": "hello"}}';
      }
    }

    const fakeLlm = new FakeLLm();

    const inputSchema = z.object({
      num1: z.number(),
      num2: z.number(),
    });
    const outputSchema = z.object({
      result: z.number(),
    });

    type Input = z.infer<typeof inputSchema>;
    type Output = z.infer<typeof outputSchema>;

    class Calculator extends StatelessFunction {
      public llm = fakeLlm;
      public name = "Calculator";
      public description = "Calculates the sum of two numbers";
      public inputSchema = inputSchema;
      public outputSchema = outputSchema;
      public promptTemplate: PromptTemplate = new PromptTemplate(
        `Calculate the sum of {{ num1 }} and {{ num2 }}`,
      );
    }

    const calculator = new Calculator();
    const executor = new Executor();
    executor.addFunction(calculator);

    executor.executeSingleFunction<Input, Output>(calculator.name, {
      num1: 2,
      num2: 3,
    });

    expect(executor).toBeDefined();
  });
});
