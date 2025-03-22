import { AiFunction } from "../ai-function/ai-function.ts";
import { z } from "zod";
import { AiExecutionEngineBase } from "../ai-execution-engine/ai-execution-engine-base.ts";
import { Prompt } from "../prompt/prompt.ts";

const schema = z.object({
  value: z.number().nullable().describe("Expression result"),
});

export type CalculatorResponse = typeof schema;

export class Calculator extends AiFunction<CalculatorResponse> {
  constructor(aiExecutionEngine?: AiExecutionEngineBase) {
    super({
      name: "Calculator",
      description: "Calculates mathematical expressions",
      prompt: new Prompt(
        "You are a true calculator, calculate and return the result of the following expression: {evaluation}",
      ),
      responseSchema: schema,
      aiExecutionEngine,
    });
  }
}
