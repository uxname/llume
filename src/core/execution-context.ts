import type { StatelessFunction } from "./core/stateless-function.ts";
import { History, type Message } from "./core/history.ts";

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
