import { describe, test } from "vitest";
import { z } from "zod";
import { Ai0LlmProvider } from "../llm/providers/ai0/ai0-llm-provider";
import { AiFunction } from "./ai-function.ts";

describe("AI Function", () => {
  test("should execute", async () => {
    const schema = z.object({
      short: z.string().describe("Short description (max 5 words)"),
      full: z.number().describe("Full description (max 30 words)"),
    });

    type schemaType = z.infer<typeof schema>;

    const llm = new Ai0LlmProvider(
      process.env.AI0_URL!,
      process.env.AI0_API_KEY!,
    );

    const func = AiFunction.create({
      query: "Tell me in simple words what is: {{input}}",
      schema: schema,
      provider: llm,
    });

    const result = await func.execute<schemaType>({
      input: "Internet",
    });

    console.log("Result:", result);
  });
});
