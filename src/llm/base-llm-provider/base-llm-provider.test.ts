import { describe, test, expect } from "vitest";
import { LLMProvider } from "../../gemini-generated";

describe("Base LLM Provider", () => {
  describe("Should response", () => {
    class MockLlmProvider extends LLMProvider {
      public name = "MockLlmProvider";
      public async execute(prompt: string): Promise<string> {
        return "Mock response, request: " + prompt;
      }
    }

    const llmProvider = new MockLlmProvider();

    test("should response", async () => {
      const response = await llmProvider.execute("Test prompt");
      expect(response).toBe("Mock response, request: Test prompt");
    });
  });
});
