import { describe, expect, test } from "vitest";
import { Ai0 } from "../../ai-execution-engine/engines/ai0/ai0.ts";
import { Calculator } from "./calculator.ts";
import { Container } from "../../container.ts";

describe("Calculator", () => {
  test("should calculate", async () => {
    const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);
    const container = new Container(engine);

    const calculator = new Calculator(engine);
    container.addAiFunction(calculator);

    const result = await calculator.execute({
      evaluation: "(two plus two) + 10 - (5 * 2)",
    });

    expect(result.value).toBe(4);
  });
});
