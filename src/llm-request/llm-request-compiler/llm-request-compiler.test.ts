import { describe, test } from "vitest";
import { LlmRequest } from "../llm-request.ts";
import { z } from "zod";
import { LlmRequestCompiler } from "./llm-request-compiler.ts";
import type { BaseTool } from "../../tool/base-tool.ts";

describe("LlmRequestCompiler", () => {
  test("should compile", () => {
    const successDataSchema = z.object({
      randomString: z.string().describe("Random 3-4 word sentence"),
      randomNumber: z.number().describe("Random number from 1 to 100"),
    });
    class RandomNumberGeneratorTool implements BaseTool {
      readonly name = "Random Number Generator";
      readonly description = "Generates random numbers";
      readonly inputSchema = z.object({
        min: z.number().describe("Minimum value"),
        max: z.number().describe("Maximum value"),
      });
      readonly outputSchema = z.object({
        number: z.number().describe("Random number"),
      });
    }

    const randomNumberGeneratorTool = new RandomNumberGeneratorTool();

    const request = new LlmRequest("Generate random data", successDataSchema, [
      randomNumberGeneratorTool,
    ]);

    const compiledRequest = LlmRequestCompiler.compile(request);
    console.log(compiledRequest);
  });
});
