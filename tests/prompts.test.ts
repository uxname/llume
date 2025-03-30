import { describe, test } from "vitest";
import { PromptHelper } from "../src/prompts/prompt-helper.ts";
import * as path from "node:path";

describe("Prompts", () => {
  test("should compile", async () => {
    const systemPromptDir = path.join(
      process.cwd(),
      "src",
      "prompts",
      "prompt-templates",
      "system-prompt",
    );

    const prompt = await PromptHelper.loadTemplate(
      path.join(systemPromptDir, "prompt.hbs"),
    );

    const compiledPrompt = PromptHelper.compile(prompt, {
      tools: JSON.stringify([
        {
          name: "test",
          description: "test",
          inputSchema: JSON.stringify({}),
          outputSchema: JSON.stringify({}),
        },
      ]),
    });

    console.log("Compiled prompt:", compiledPrompt);
  });
});
