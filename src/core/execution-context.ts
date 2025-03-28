import type { StatelessFunction } from "./base-classes/stateless-function.ts";
import { History, type Message } from "./base-classes/history.ts";

export class ExecutionContext {
  llmHistory = new History();

  protected functions: Map<string, StatelessFunction> = new Map();

  addFunction(aiStatelessFunction: StatelessFunction): void {
    this.functions.set(aiStatelessFunction.name, aiStatelessFunction);
  }

  addHistoryMessage(message: Message): void {
    this.llmHistory.addMessage(message);
  }
}
