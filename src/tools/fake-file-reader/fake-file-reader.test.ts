import { describe, expect, test } from "vitest";
import { FakeFileReader } from "./fake-file-reader.ts";
import { Container } from "../../container.ts";
import { LineCounter } from "../../ai-functions/line-counter/line-counter.ts";
import { Ai0 } from "../../ai-execution-engine/engines/ai0/ai0.ts";

describe("Fake File reader", () => {
  test("should read file", async () => {
    const fileReader = new FakeFileReader();
    const filePath = "test.txt";
    const fileContent = await fileReader.execute({ path: filePath });

    expect(fileContent.content).contains("Content of test.txt");
  });

  test("should call tool", async () => {
    const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!);
    const container = new Container(engine);

    const lineCounter = new LineCounter();
    container.registerAiFunction(lineCounter);

    const fakeFileReaderTool = new FakeFileReader();
    container.addTool(fakeFileReaderTool);

    const result = await lineCounter.execute({
      filePath: "test.txt",
    });

    expect(result.count).toBeGreaterThanOrEqual(0);
    expect(result.count).toBeLessThanOrEqual(30);
  });
});
