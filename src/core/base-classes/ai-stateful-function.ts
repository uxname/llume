import { State } from "./state.ts";
import {
  AiStatelessFunction,
  type Variables,
} from "./ai-stateless-function.ts";
import type { AiArea } from "../ai-area.ts";

export class AiStatefulFunction<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> extends AiStatelessFunction<TInput, TOutput> {
  constructor(
    base: AiStatelessFunction<TInput, TOutput>,
    public area: AiArea,
    public state: State,
  ) {
    super(
      base.llm,
      base.name,
      base.description,
      base.inputSchema,
      base.outputSchema,
      base.systemPrompts,
      base.prompts,
      base.tools,
      base.aiStatelessFunctions,
      base.preRunMiddleware,
      base.postRunMiddleware,
    );
  }
}
