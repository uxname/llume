import type { Variables } from "./stateless-function.ts";

export class History {
  public messages: Message[] = [];

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  toString(): string {
    return JSON.stringify(this.messages);
  }
}

export interface ToolResponseMessage {
  toolName: string;
  toolResponse: Variables;
}

export type Message = {
  role: "user" | "assistant";
  content?: Variables | string | undefined;
  toolResponse?: ToolResponseMessage | undefined;
};
