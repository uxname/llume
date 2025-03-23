import { ToolBase, type ToolMetadata } from "../../tool-base/tool-base.ts";
import { z } from "zod";

const inputSchema = z.object({
  path: z.string(),
});

type inputType = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  content: z.string(),
  name: z.string(),
});

type outputType = z.infer<typeof outputSchema>;

export class FakeFileReader extends ToolBase<inputType, outputType> {
  getMetadata(): ToolMetadata {
    return {
      name: "File Reader",
      description: "Reads the content of a file",
      inputSchema,
      outputSchema,
    };
  }
  async execute(params: inputType): Promise<{ content: string; name: string }> {
    return {
      name: params.path,
      content: `Content of ${params.path}\n`.repeat(10),
    };
  }
}
