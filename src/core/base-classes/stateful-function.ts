import { State } from "./state.ts";
import { StatelessFunction, type Variables } from "./stateless-function.ts";
import type { ExecutionContextStore } from "../execution-context-store.ts";

export class StatefulFunction<
  TInput extends Variables = Variables,
  TOutput extends Variables = Variables,
> extends StatelessFunction<TInput, TOutput> {
  constructor(
    base: StatelessFunction<TInput, TOutput>,
    public area: ExecutionContextStore,
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
