export class History {
  public messages: Message[] = [];

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  toString(): string {
    return this.messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
  }
}

export class Message {
  constructor(
    public role: "user" | "assistant",
    public content: string,
  ) {}
}
