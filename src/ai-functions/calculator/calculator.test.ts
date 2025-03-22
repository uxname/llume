import { describe, expect, test } from "vitest";
import { Ai0 } from "../../ai-execution-engine/engines/ai0/ai0.ts";
import { Calculator } from "./calculator.ts";

describe("Calculator", () => {
  test("should calculate", async () => {
    const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);

    const aiFunction = new Calculator(engine);
    const evaluation = "(two plus two) + 10 - (5 * 2)";

    const result = await aiFunction.execute({ evaluation });

    expect(result.value).toBe(4);
  });
});
