import type { StatelessFunction } from "./core/stateless-function.ts";
import { History, type Message } from "./core/history.ts";

export class ExecutionContext {
  llmHistory = new History();

  protected functions: Map<string, StatelessFunction> = new Map();

  addFunction(aiStatelessFunction: StatelessFunction): void {
    this.functions.set(aiStatelessFunction.name, aiStatelessFunction);
  }

  addHistoryMessage(message: Message): void {
    const header = `[${message.role.toUpperCase()}${
      message.toolResponse?.toolName
        ? " (" + message.toolResponse.toolName + ")"
        : ""
    }]`;

    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content) ||
          JSON.stringify(message.toolResponse?.toolResponse);

    const formattedMessage = `${header.padEnd(24)}${content}`;

    console.log(formattedMessage);
    this.llmHistory.addMessage(message);
  }
}
