import { describe, expect, test } from "vitest";
import { Ai0LlmProvider } from "./ai0-llm-provider.ts";

describe("AI0 LLM Provider", () => {
  describe("Should response", () => {
    const baseUrl = process.env.AI0_URL!;
    const apiKey = process.env.AI0_API_KEY!;
    const llmProvider = new Ai0LlmProvider(baseUrl, apiKey);

    test("should response", async () => {
      const response = await llmProvider.executeRaw("2+2");
      expect(response).toBeTypeOf("string");
      expect(response).not.toBeUndefined();
      expect(response).not.toBe("");
    });
  });
});
