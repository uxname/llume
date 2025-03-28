import { z } from "zod";
import { PromptTemplate } from "./prompt-template.ts";
import { Tool } from "./tool.ts";
import { LLM } from "./llm.ts";

type Primitive = string | number | boolean | null | undefined;

export type Variables = {
  [key: string]: Primitive | Variables;
};

export class StatelessFunction<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> {
  constructor(
    public llm: LLM,
    public name: string,
    public description: string,
    public inputSchema: z.Schema<TInput>,
    public outputSchema: z.Schema<TOutput>,
    public systemPrompts: PromptTemplate[],
    public prompts: PromptTemplate[],
    public tools: Tool[],
    public aiStatelessFunctions: StatelessFunction[],
    public preRunMiddleware: (input: TInput) => Promise<TInput>,
    public postRunMiddleware: (output: TOutput) => Promise<TOutput>,
  ) {}
}
