import type { StatelessFunction } from "./base-classes/stateless-function.ts";
import { History, type Message } from "./base-classes/history.ts";

export class ExecutionContext {
  llmHistory = new History();

  protected functions: Map<string, StatelessFunction> = new Map();

  addFunction(aiStatelessFunction: StatelessFunction): void {
    this.functions.set(aiStatelessFunction.name, aiStatelessFunction);
  }

  addHistoryMessage(message: Message): void {
    // Формируем заголовок с учетом toolName
    const header = `[${message.role.toUpperCase()}${
      message.toolResponse?.toolName
        ? " (" + message.toolResponse.toolName + ")"
        : ""
    }]`;

    // Определяем содержимое сообщения
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content) ||
          JSON.stringify(message.toolResponse?.toolResponse);

    // Выравниваем заголовок по левому краю с фиксированной шириной
    const formattedMessage = `${header.padEnd(24)}${content}`;

    console.log(formattedMessage);
    this.llmHistory.addMessage(message);
  }
}
