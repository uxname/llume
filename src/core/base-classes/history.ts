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
  toolResponse: object;
}

export type Message = {
  role: "user" | "assistant";
  content?: object | string | undefined;
  toolResponse?: ToolResponseMessage | undefined;
};
