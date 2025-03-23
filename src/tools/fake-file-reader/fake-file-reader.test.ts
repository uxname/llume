import { describe, expect, test } from "vitest";
import { FakeFileReader } from "./fake-file-reader.ts";

describe("Fake File reader", () => {
  test("should read file", async () => {
    const fileReader = new FakeFileReader();
    const filePath = "test.txt";
    const fileContent = await fileReader.execute({ path: filePath });

    expect(fileContent.content).contains("Content of test.txt");
  });
});
