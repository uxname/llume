import { z } from "zod";
import { PromptTemplate } from "./prompt-template.ts";
import { Tool } from "./tool.ts";
import { LLM } from "./llm.ts";

type Primitive = string | number | boolean | null | undefined;

export type Variables = {
  [key: string]: Primitive | Variables;
};

export abstract class StatelessFunction<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> {
  public abstract llm: LLM;

  public abstract name: string;
  public abstract description: string;

  public abstract inputSchema: z.Schema<TInput>;
  public abstract outputSchema: z.Schema<TOutput>;

  public abstract promptTemplate: PromptTemplate;

  public tools?: Tool[];
  public aiStatelessFunctions?: StatelessFunction[];

  public preRunMiddleware?: (input: TInput) => Promise<TInput>;
  public postRunMiddleware?: (output: TOutput) => Promise<TOutput>;
}
