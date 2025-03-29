import { z } from "zod";
import { PromptTemplate } from "./prompt-template.ts";
import { Tool } from "./tool.ts";
import { LLM } from "./llm.ts";
import { EventType } from "./prompt/schemas.ts";
import type { MiddlewareEvent } from "./prompt/schemas.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionVariables = Record<string, any>;

export type MiddlewareFunction = (event: MiddlewareEvent) => Promise<void>;

export abstract class AiFunction<
  TInput extends FunctionVariables = FunctionVariables,
  TOutput extends FunctionVariables = FunctionVariables,
> {
  public abstract llm: LLM;

  public abstract name: string;
  public abstract description: string;

  public abstract inputSchema: z.Schema;
  public abstract outputSchema: z.Schema;

  public abstract promptTemplate: PromptTemplate;

  public tools?: Tool[];
  public aiFunctions?: AiFunction[];

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

  // Backward compatibility methods
  public async preRunMiddleware(input: TInput): Promise<void> {
    await this.runMiddleware({
      type: EventType.LLM_REQUEST,
      initiator: "user",
      functionName: this.name,
      input,
      timestamp: Date.now(),
    });
    return Promise.resolve();
  }

  public async postRunMiddleware(output: TOutput): Promise<void> {
    await this.runMiddleware({
      type: EventType.LLM_RESPONSE,
      initiator: "llm",
      functionName: this.name,
      output,
      timestamp: Date.now(),
    });
    return Promise.resolve();
  }
}
