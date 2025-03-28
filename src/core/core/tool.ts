import { z } from "zod";
import type { Variables } from "./stateless-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";

export abstract class Tool<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> {
  public abstract name: string;
  public abstract description: string;

  public abstract inputSchema: z.Schema<TInput>;
  public abstract outputSchema: z.Schema<TOutput>;
  public abstract execute(input: TInput): Promise<TOutput>;

  public toString(): string {
    return JSON.stringify({
      name: this.name,
      description: this.description,
      inputSchema: zodToJsonSchema(this.inputSchema),
      outputSchema: zodToJsonSchema(this.outputSchema),
    });
  }
}
