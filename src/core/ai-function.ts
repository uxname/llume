import { z } from "zod";
import { PromptTemplate } from "./prompt-template.ts";
import { Tool } from "./tool.ts";
import { LLM } from "./llm.ts";
import type { MiddlewareEvent } from "./prompt/schemas.ts";
import type { ExecutionContext } from "./execution-context.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionVariables = Record<string, any>;

export type MiddlewareFunction = (event: MiddlewareEvent) => Promise<void>;

export abstract class AiFunction<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TInput extends FunctionVariables = FunctionVariables,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TOutput extends FunctionVariables = FunctionVariables,
> {
  public abstract llm: LLM;

  public abstract name: string;
  public abstract description: string;

  public abstract inputSchema: z.Schema;
  public abstract outputSchema: z.Schema;

  public abstract promptTemplate: PromptTemplate;

  public tools?: Tool[];
  public childAiFunctions?: AiFunction[];

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

  public async runMiddleware(
    event: Omit<MiddlewareEvent, "executionContext">,
    context: ExecutionContext,
  ): Promise<void> {
    const fullEvent: MiddlewareEvent = {
      ...event,
      executionContext: context,
    };
    for (const middleware of this.middlewares) {
      // Передаем полный event с контекстом
      await middleware(fullEvent);
    }
  }
}
