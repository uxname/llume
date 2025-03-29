import { z } from "zod";
import type { FunctionVariables, MiddlewareFunction } from "./ai-function.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EventType } from "./prompt/schemas.ts";
import type { MiddlewareEvent } from "./prompt/schemas.ts";
import type { ExecutionContext } from "./execution-context.ts";

export abstract class Tool<
  TInput extends FunctionVariables = FunctionVariables,
  TOutput extends FunctionVariables = FunctionVariables,
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

  public async runMiddleware(
    event: Omit<MiddlewareEvent, "executionContext">,
    context: ExecutionContext,
  ): Promise<void> {
    const fullEvent: MiddlewareEvent = {
      ...event,
      executionContext: context,
    };
    for (const middleware of this.middlewares) {
      await middleware(fullEvent);
    }
  }

  public async execute(
    input: TInput,
    context: ExecutionContext,
  ): Promise<TOutput> {
    await this.runMiddleware(
      {
        type: EventType.TOOL_REQUEST,
        initiator: "llm",
        toolName: this.name,
        input,
        timestamp: Date.now(),
      },
      context,
    );

    const result = await this.executeImpl(input); // executeImpl не получает context

    await this.runMiddleware(
      {
        type: EventType.TOOL_RESPONSE,
        initiator: "llm", // Оставляем llm, т.к. это ответ на запрос llm
        toolName: this.name,
        input,
        output: result,
        timestamp: Date.now(),
      },
      context,
    );

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
