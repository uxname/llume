import { z } from "zod";
import { PromptTemplate } from "./prompt-template.ts";
import { Tool } from "./tool.ts";
import { LLM } from "./llm.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Variables = Record<string, any>;

export abstract class StatelessFunction<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> {
  public abstract llm: LLM;

  public abstract name: string;
  public abstract description: string;

  public abstract inputSchema: z.Schema;
  public abstract outputSchema: z.Schema;

  public abstract promptTemplate: PromptTemplate;

  public tools?: Tool[];
  public aiStatelessFunctions?: StatelessFunction[];

  public preRunMiddleware(input: TInput): Promise<void> {
    return Promise.resolve();
  }
  public postRunMiddleware(output: TOutput): Promise<void> {
    return Promise.resolve();
  }
}
