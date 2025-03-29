import type { StatelessFunction } from "./stateless-function.ts";
import { History, type Message } from "./history.ts";

export class ExecutionContext {
  public llmHistory = new History();
  public readonly historyLimit: number; // Делаем его публичным readonly

  protected functions: Map<string, StatelessFunction> = new Map();

  /**
   * @param historyLimit Максимальное количество сообщений (включая первое),
   *                     передаваемых в LLM для сохранения контекста.
   *                     По умолчанию 10.
   */
  constructor(historyLimit: number = 10) {
    if (historyLimit < 2) {
      console.warn("History limit must be at least 2. Setting to 2.");
      this.historyLimit = 2;
    } else {
      this.historyLimit = historyLimit;
    }
  }

  addFunction(aiStatelessFunction: StatelessFunction): void {
    this.functions.set(aiStatelessFunction.name, aiStatelessFunction);
  }

  addHistoryMessage(message: Message): void {
    this.llmHistory.addMessage(message);
  }
}
