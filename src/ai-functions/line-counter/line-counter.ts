import { z } from "zod";
import { Prompt } from "../../prompt/prompt.ts";
import { AiFunction } from "../../ai-function-base/ai-function.ts";

const schema = z.object({
  count: z.number().nullable().describe("Count of lines"),
});

export type LineCounterResponse = typeof schema;

export class LineCounter extends AiFunction<LineCounterResponse> {
  constructor() {
    super({
      name: "Line Counter",
      description: "Counts the number of lines in a file",
      prompt: new Prompt(
        `You are a true line counter, count and return the number of lines in the following file: {filePath}`,
      ),
      responseSchema: schema,
    });
  }
}
