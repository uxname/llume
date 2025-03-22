import { beforeAll, describe, expect, test } from "vitest";
import { Prompt } from "../prompt/prompt.ts";
import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import { AiExecutionEngineBase } from "../ai-execution-engine/ai-execution-engine-base.ts";
import { Ai0 } from "../ai-execution-engine/engines/ai0/ai0.ts";
import { Container } from "../container.ts";

describe("AiFunction", () => {
  const schema = z.object({
    value: z.number().nullable().describe("Expression result"),
    errors: z.array(z.string()).nullable().describe("List of errors if any"),
  });

  type CalculatorResponse = typeof schema;

  class TestAiFunction extends AiFunction<CalculatorResponse> {
    constructor() {
      super({
        name: "Calculator",
        description: "Calculates mathematical expressions",
        prompt: new Prompt(
          "You are a true calculator, calculate and return the result of the following expression: {evaluation}",
        ),
        responseSchema: schema,
      });
    }
  }

  const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);
  const aiFunction = new TestAiFunction(engine);
  const container = new Container(engine);

  beforeAll(() => {
    container.addAiFunction(aiFunction);
  });

  test("renders basic template with params", async () => {
    const evaluation = "2 + 2";
    const renderedPrompt = aiFunction.render({ evaluation });
    expect(renderedPrompt)
      .toEqual(`You are a true calculator, calculate and return the result of the following expression: 2 + 2
Answer format json should according to the following JSON schema:
{"allOf":[{"type":"object","properties":{"value":{"type":["number","null"],"description":"Expression result"},"errors":{"anyOf":[{"type":"array","items":{"type":"string"}},{"type":"null"}],"description":"List of errors if any"}},"required":["value","errors"]},{"type":"object","properties":{"_error":{"type":"object","properties":{"message":{"type":"string","description":"Error message"}},"required":["message"],"additionalProperties":false}}}],"$schema":"http://json-schema.org/draft-07/schema#"}
Fill the field "error" only if you can't answer the question.
Do not send unknown other data. Do not send markdown.`);

    const result = await aiFunction.execute({ evaluation });
    expect(result.value).toBe(4);
    expect(result._error).toBeUndefined();
    expect(result._raw).toBeDefined();
  });

  test("should generate function info", () => {
    class TestAiFunction extends AiFunction<CalculatorResponse> {
      constructor() {
        super({
          name: "Calculator",
          description: "Calculates mathematical expressions",
          prompt: new Prompt(
            "You are a true calculator, calculate and return the result of the following expression: {evaluation}",
          ),
          responseSchema: schema,
        });
      }
    }
    const aiFunction = new TestAiFunction();
    const info = aiFunction.toJson();
    expect(info.name).toBe("Calculator");
    expect(info.description).toBe("Calculates mathematical expressions");
  });
});
