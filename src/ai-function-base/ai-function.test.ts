import { describe, expect, test } from "vitest";
import { Prompt } from "../prompt/prompt.ts";
import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import { AiExecutionEngineBase } from "../ai-execution-engine/ai-execution-engine-base.ts";
import { Ai0 } from "../ai-execution-engine/engines/ai0/ai0.ts";

describe("AiFunction", () => {
  test("renders basic template with params", async () => {
    const schema = z.object({
      value: z.number().nullable().describe("Expression result"),
      errors: z.array(z.string()).nullable().describe("List of errors if any"),
    });

    type CalculatorResponse = typeof schema;

    class TestAiFunction extends AiFunction<CalculatorResponse> {
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

    const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);
    const aiFunction = new TestAiFunction(engine);
    const evaluation = "2 + 2";
    const renderedPrompt = aiFunction.render({ evaluation });
    expect(renderedPrompt)
      .toEqual(`You are a true calculator, calculate and return the result of the following expression: 2 + 2
Answer format json should according to the following JSON schema:
{"type":"object","properties":{"value":{"type":["number","null"],"description":"Expression result"},"errors":{"anyOf":[{"type":"array","items":{"type":"string"}},{"type":"null"}],"description":"List of errors if any"}},"required":["value","errors"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
Do not send any other data. Do not send markdown.`);

    const result = await aiFunction.execute({ evaluation });
    expect(result).toEqual({
      value: 4,
      errors: null,
      _raw: {
        value: 4,
        errors: null,
      },
    });
  });
});
