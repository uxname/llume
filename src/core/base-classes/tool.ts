import { z } from "zod";
import type { Variables } from "./stateless-function.ts";

export class Tool<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> {
  constructor(
    public name: string,
    public description: string,

    public inputSchema: z.Schema<TInput>,
    public outputSchema: z.Schema<TOutput>,
    public execute: (input: TInput) => Promise<TOutput>,
  ) {}
}
