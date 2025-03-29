import type { AiFunction } from "./ai-function.ts";
import { History, type HistoryMessage } from "./history.ts";

export class ExecutionContext {
  public executionHistory = new History();
  public readonly historyLimit: number; // Делаем его публичным readonly

  protected functions: Map<string, AiFunction> = new Map();

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

  addFunction(aiFunction: AiFunction): void {
    this.functions.set(aiFunction.name, aiFunction);
  }

  addHistoryMessage(message: HistoryMessage): void {
    this.executionHistory.addMessage(message);
  }
}
