import { describe, expect, test } from "vitest";
import { Ai0 } from "../../ai-execution-engine/engines/ai0/ai0.ts";
import { LineCounter } from "./line-counter.ts";
import { Container } from "../../container.ts";

describe("Line counter", () => {
  const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);
  const container = new Container(engine);

  const lineCounter = new LineCounter();
  container.registerAiFunction(lineCounter);

  test("should count lines", async () => {
    const result = await lineCounter.execute({
      filePath: "test.txt",
    });

    expect(result.count).toBe(10);
  });
});
