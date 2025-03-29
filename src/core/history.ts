import type { FunctionVariables } from "./ai-function.ts";

export class History {
  public messages: HistoryMessage[] = [];

  addMessage(message: HistoryMessage): void {
    this.messages.push(message);
  }

  /**
   * Возвращает ограниченный набор сообщений для передачи в LLM.
   * Включает первое сообщение и N последних сообщений.
   * @param limit - Максимальное количество сообщений для возврата (включая первое).
   *                Если общее количество сообщений меньше или равно limit, возвращаются все сообщения.
   *                Минимальное значение limit - 2 (первое и последнее).
   * @returns Массив сообщений, готовый к передаче в LLM.
   */
  getLimitedMessages(limit: number): HistoryMessage[] {
    const actualLimit = Math.max(limit, 2); // Гарантируем хотя бы первое и последнее, если возможно

    if (this.messages.length <= actualLimit) {
      return [...this.messages]; // Возвращаем все, если их меньше или равно лимиту
    }

    const firstMessage = this.messages[0];
    const lastMessages = this.messages.slice(-(actualLimit - 1)); // Берем N-1 последних сообщений

    // Убедимся, что первое сообщение не дублируется, если оно уже попало в "последние"
    // (это возможно только если limit=2 и сообщений > 2)
    if (
      lastMessages.length > 0 &&
      this.messages.length > 1 &&
      lastMessages[0] === firstMessage
    ) {
      // Если первое сообщение оказалось единственным в lastMessages (при limit=2),
      // нужно вернуть первое и самое последнее
      if (lastMessages.length === 1) {
        return [firstMessage, this.messages[this.messages.length - 1]];
      }
      // Если первое сообщение попало в срез lastMessages, но не является единственным элементом среза
      // (например, limit=3, сообщений 3, срез будет [msg0, msg1, msg2], lastMessages = [msg1, msg2]),
      // то можно просто вернуть [firstMessage, ...lastMessages] как есть, дублирования не будет.
      // Однако, если limit=3 и сообщений=2, то lastMessages=[msg0, msg1], и [first, ...last] -> [msg0, msg0, msg1] - дубль.
      // Но этот случай покрывается первой проверкой `this.messages.length <= actualLimit`.
      // Проверим самый сложный случай: limit=2, сообщений > 2. lastMessages будет [lastMsg].
      // Тогда вернется [firstMsg, lastMsg] - корректно.
      // Проверим: limit=3, сообщений > 3. lastMessages = [предпоследнее, последнее].
      // Вернется [firstMsg, предпоследнее, последнее] - корректно.
      // Значит, дополнительная проверка на дублирование первого сообщения не нужна,
      // если мы берем срез `slice(-(actualLimit - 1))`.
    }

    return [firstMessage, ...lastMessages];
  }

  /**
   * Возвращает всю историю в виде строки JSON.
   * Полезно для логирования или отладки.
   */
  toString(): string {
    return JSON.stringify(this.messages, null, 2); // Добавим форматирование для читаемости
  }

  /**
   * Возвращает ограниченную историю в виде строки JSON.
   * @param limit - Максимальное количество сообщений (см. getLimitedMessages).
   */
  getLimitedMessagesAsString(limit: number): string {
    return JSON.stringify(this.getLimitedMessages(limit));
  }
}

// Интерфейсы Message и ToolResponseMessage остаются без изменений
export interface ToolResponsePayload {
  toolName: string;
  toolResponse: FunctionVariables;
}

export type HistoryMessage = {
  role: "user" | "assistant";
  content?: FunctionVariables | string | undefined; // Убедимся, что content может быть Variables (JSON)
  toolResponse?: ToolResponsePayload | undefined;
};
