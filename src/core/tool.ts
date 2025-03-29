import { z } from "zod";
import type { Variables, MiddlewareFunction } from "./ai-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EventType } from "./prompt/schemas.ts";
import type { MiddlewareEvent } from "./prompt/schemas.ts";

export abstract class Tool<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> {
  public abstract name: string;
  public abstract description: string;

  public abstract inputSchema: z.Schema<TInput>;
  public abstract outputSchema: z.Schema<TOutput>;

  private middlewares: MiddlewareFunction[] = [];

  public addMiddleware(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
  }

  public removeMiddleware(middleware: MiddlewareFunction): void {
    const index = this.middlewares.indexOf(middleware);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
    }
  }

  public async runMiddleware(event: MiddlewareEvent): Promise<void> {
    for (const middleware of this.middlewares) {
      await middleware(event);
    }
  }

  public async execute(input: TInput): Promise<TOutput> {
    // Call middleware before execution
    await this.runMiddleware({
      type: EventType.TOOL_REQUEST,
      initiator: "llm",
      toolName: this.name,
      input,
      timestamp: Date.now(),
    });

    // Execute the tool
    const result = await this.executeImpl(input);

    // Call middleware after execution
    await this.runMiddleware({
      type: EventType.TOOL_RESPONSE,
      initiator: "llm", // Changed from "tool" to match type definition
      toolName: this.name,
      input,
      output: result,
      timestamp: Date.now(),
    });

    return result;
  }

  protected abstract executeImpl(input: TInput): Promise<TOutput>;

  public toString(): string {
    return JSON.stringify({
      name: this.name,
      description: this.description,
      inputSchema: zodToJsonSchema(this.inputSchema),
      outputSchema: zodToJsonSchema(this.outputSchema),
    });
  }
}
