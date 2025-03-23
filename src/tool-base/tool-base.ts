import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface ToolMetadata<
  INPUT extends z.ZodType = z.ZodType,
  OUTPUT extends z.ZodType = z.ZodType,
> {
  name: string;
  description: string;
  inputSchema: INPUT;
  outputSchema: OUTPUT;
  examples?: string[];
}

export abstract class ToolBase<
  TInput extends z.infer<z.ZodType>,
  TOutput extends z.infer<z.ZodType>,
> {
  abstract getMetadata(): ToolMetadata;

  abstract execute(params: TInput): Promise<TOutput>;

  toString(): string {
    const inputSchema = zodToJsonSchema(this.getMetadata().inputSchema);
    const outputSchema = zodToJsonSchema(this.getMetadata().outputSchema);
    return JSON.stringify({
      name: this.getMetadata().name,
      description: this.getMetadata().description,
      inputSchema,
      outputSchema,
    });
  }
}
