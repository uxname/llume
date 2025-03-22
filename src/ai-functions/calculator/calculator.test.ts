import { describe, expect, test } from "vitest";
import { Ai0 } from "../../ai-execution-engine/engines/ai0/ai0.ts";
import { Calculator } from "./calculator.ts";
import { Container } from "../../container.ts";

describe("Calculator", () => {
  const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);
  const container = new Container(engine);

  const calculator = new Calculator(engine);
  container.addAiFunction(calculator);

  test("should calculate", async () => {
    const result = await calculator.execute({
      evaluation: "two plus two",
    });

    expect(result.value).toBe(4);
  });

  test("should not calculate", async () => {
    const result = await calculator.execute({
      evaluation: "1/0",
    });

    console.log("!!!!!!!", result);
  });
});
