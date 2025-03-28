import type { StatelessFunction } from "./base-classes/stateless-function.ts";
import { History } from "./base-classes/history.ts";
import { State } from "./base-classes/state.ts";
import { StatefulFunction } from "./base-classes/stateful-function.ts";

export class ExecutionContextStore {
  llmHistory = new History();
  protected functions: Map<string, StatefulFunction> = new Map();

  addFunction(aiStatelessFunction: StatelessFunction): void {
    const state = new State();
    const executableAiFunction = new StatefulFunction(
      aiStatelessFunction,
      this,
      state,
    );
    this.functions.set(aiStatelessFunction.name, executableAiFunction);
  }
}
