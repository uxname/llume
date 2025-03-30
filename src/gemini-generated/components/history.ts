// src/components/history.ts
import type { FunctionVariables } from "../schemas"; // Assuming FunctionVariables is defined here or in types

// Re-using the types from the original implementation
export interface ToolResponsePayload {
  toolName: string;
  toolResponse:
    | FunctionVariables
    | { _type: string; _message: string; [key: string]: any }; // Allow error objects too
}

export type HistoryMessageContent = FunctionVariables | string | undefined;

export type HistoryMessage = {
  role: "user" | "assistant";
  content?: HistoryMessageContent;
  toolResponse?: ToolResponsePayload | undefined;
};

/**
 * Manages the conversation history for an Agent execution.
 */
export class History {
  public messages: HistoryMessage[] = [];

  /**
   * Adds a message to the end of the history.
   * @param message - The message object to add.
   */
  addMessage(message: HistoryMessage): void {
    // Basic validation or sanitization could be added here
    this.messages.push(message);
  }

  /**
   * Returns a limited set of messages for passing to the LLM.
   * Includes the first message and the N most recent messages.
   *
   * @param limit - The maximum number of messages to return (including the first).
   *                Must be at least 2 if more than 1 message exists.
   * @returns An array of messages suitable for the LLM llm-request.
   */
  getLimitedMessages(limit: number): HistoryMessage[] {
    const actualLimit = Math.max(limit, 2); // Ensure at least 2 if possible

    if (this.messages.length <= actualLimit) {
      return [...this.messages]; // Return all if count is within limit
    }

    const firstMessage = this.messages[0];
    // Slice the last 'limit - 1' messages
    const lastMessages = this.messages.slice(-(actualLimit - 1));

    // The slice logic inherently prevents duplication of the first message
    // unless limit is 2 and there are exactly 2 messages, which is covered by the first check.
    return [firstMessage, ...lastMessages];
  }

  /**
   * Returns the complete history as a formatted JSON string.
   * Useful for logging or debugging.
   */
  toString(): string {
    return JSON.stringify(this.messages, null, 2);
  }

  /**
   * Returns the limited history as a formatted JSON string.
   * @param limit - The maximum number of messages (see getLimitedMessages).
   */
  getLimitedMessagesAsString(limit: number): string {
    return JSON.stringify(this.getLimitedMessages(limit), null, 2);
  }

  /**
   * Clears all messages from the history.
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Gets the last message added to the history.
   * @returns The last message, or undefined if history is empty.
   */
  getLastMessage(): HistoryMessage | undefined {
    return this.messages[this.messages.length - 1];
  }
}
