/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExecutionContext } from "./execution-context.ts";
import type { Variables } from "./core/stateless-function.ts";
import { PromptBuilder } from "./core/prompt/prompt-builder.ts";
import type {
  BaseSuccessType,
  CallToolType,
  ErrorType,
  LLMResult,
} from "./core/prompt/schemas.ts";
import type { Message } from "./core/history.ts"; // Импортируем Message

export class Executor extends ExecutionContext {
  // Конструктор наследуется от ExecutionContext, включая historyLimit

  async executeSingleFunction<
    TInput extends Variables,
    TOutput extends Variables,
  >(
    functionName: string,
    input: TInput, // Входные данные для *текущего* вызова
  ): Promise<LLMResult<unknown | TOutput>> {
    // Тип TOutput здесь может быть не совсем точным, т.к. LLM может вернуть и Error/CallTool
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`Function ${functionName} not found`);
    }

    // Строим промпт, используя ограниченную историю и текущий ввод
    const prompt = PromptBuilder.buildExecuteFunctionPrompt(
      this.llmHistory, // Передаем весь объект History
      aiFunction,
      input, // Передаем текущие переменные для рендеринга {{query}}
      aiFunction.tools ?? [],
      this.historyLimit, // Передаем лимит истории
    );

    // Здесь можно добавить логирование самого промпта перед отправкой в LLM
    // console.log("--- LLM PROMPT ---");
    // console.log(prompt);
    // console.log("------------------");

    const response = await aiFunction.llm.execute(prompt);

    // Здесь нужна более надежная обработка JSON (как обсуждалось в п.1 улучшений)
    try {
      // Попытка извлечь JSON из возможного markdown блока
      const jsonMatch = response.match(
        /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/,
      );
      if (!jsonMatch || (!jsonMatch[1] && !jsonMatch[2])) {
        console.error(
          "LLM response does not contain a recognizable JSON structure:",
          response,
        );
        // Можно вернуть стандартную ошибку или попытаться обработать как текст?
        // Пока вернем ошибку, т.к. ожидаем JSON
        return { _type: "error", _message: "LLM response is not valid JSON." };
      }
      const jsonString = jsonMatch[1] || jsonMatch[2]; // Берем или из блока ```json или просто {.*}
      return JSON.parse(jsonString) as LLMResult<TOutput>; // Парсим извлеченную строку
    } catch (error) {
      console.error("Failed to parse LLM response:", response, error);
      return {
        _type: "error",
        _message: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async callTool<TInput extends Variables, TOutput extends Variables>(
    functionName: string, // Нужен для поиска нужного тула
    toolName: string,
    input: TInput,
  ): Promise<TOutput> {
    // Здесь TOutput - это тип возвращаемый тулом
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      // Можно добавить ошибку в историю? Или просто пробросить?
      throw new Error(`[callTool] Function ${functionName} not found`);
    }

    const tool = aiFunction.tools?.find((t) => t.name === toolName);
    if (!tool) {
      // Добавляем сообщение об ошибке в историю, чтобы LLM знал
      this.addHistoryMessage({
        role: "assistant", // Или "system"? Роль "assistant" кажется логичной, т.к. это ответ на его запрос
        content: {
          // Используем content вместо toolResponse, т.к. это не результат, а ошибка
          _type: "error",
          _message: `Tool '${toolName}' requested by the assistant was not found in function '${functionName}'.`,
        },
      });
      throw new Error(
        `[callTool] Tool ${toolName} not found in function ${functionName}`,
      );
    }

    try {
      // Используем execute тула, который включает middleware
      const result = await tool.execute(input);
      // Валидация результата тула по его outputSchema? (Опционально, но полезно)
      try {
        tool.outputSchema.parse(result);
      } catch (validationError) {
        console.error(
          `[callTool] Tool ${toolName} output validation failed:`,
          validationError,
        );
        // Как обработать? Отправить ошибку валидации LLM?
        // Отправляем информацию об ошибке валидации обратно в историю
        this.addHistoryMessage({
          role: "user", // Представляем это как ответ "системы" или "окружения" на вызов тула
          toolResponse: {
            toolName: toolName,
            toolResponse: {
              // Оборачиваем ошибку
              _type: "tool_execution_error",
              _message: `Tool output validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
              _invalidOutput: result, // Посылаем некорректный вывод для контекста
            },
          },
        });
        // Можно либо пробросить ошибку, либо вернуть специальный объект ошибки
        throw new Error(`Tool ${toolName} output validation failed.`);
      }
      return result as TOutput;
    } catch (error) {
      console.error(`[callTool] Error executing tool ${toolName}:`, error);
      // Отправляем информацию об ошибке выполнения тула обратно в историю
      this.addHistoryMessage({
        role: "user", // Представляем это как ответ "системы"
        toolResponse: {
          toolName: toolName,
          toolResponse: {
            _type: "tool_execution_error",
            _message: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
          },
        },
      });
      // Пробрасываем ошибку дальше, чтобы smartExecute мог ее поймать
      throw error; // Важно пробросить, чтобы цикл в smartExecute прервался или обработал ошибку
    }
  }

  // --- Итеративная версия smartExecute ---
  async smartExecute<TInput extends Variables, TOutput extends Variables>(
    functionName: string,
    initialInput: TInput, // Переименуем для ясности
    maxIterations: number = 5, // Добавим лимит итераций для предотвращения бесконечных циклов
  ): Promise<TOutput> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`[smartExecute] Function ${functionName} not found`);
    }

    // Middleware вызывается один раз перед началом всего процесса
    await aiFunction.preRunMiddleware(initialInput);

    const currentInput = { ...initialInput }; // Копируем для возможных модификаций (хотя сейчас не используется)
    let iteration = 0;

    // Добавляем *начальный* запрос пользователя в историю только один раз
    // Проверяем, не пустое ли тело у promptTemplate, чтобы не добавлять пустые сообщения
    const initialUserQuery = aiFunction.promptTemplate
      .render<TInput>(initialInput)
      .trim();
    if (initialUserQuery) {
      // Добавляем только если это первый запуск для этого Executor'а ИЛИ
      // если последнее сообщение не точно такое же (предотвращение дублей при retry)
      if (
        this.llmHistory.messages.length === 0 ||
        JSON.stringify(
          this.llmHistory.messages[this.llmHistory.messages.length - 1],
        ) !== JSON.stringify({ role: "user", content: initialUserQuery })
      ) {
        this.addHistoryMessage({
          role: "user",
          content: initialUserQuery,
        });
      }
    }

    while (iteration < maxIterations) {
      iteration++;
      // console.log(`--- Smart Execute Iteration: ${iteration} ---`);

      // Выполняем один шаг LLM
      const result: LLMResult<TOutput | unknown> =
        await this.executeSingleFunction(
          functionName,
          currentInput, // Передаем текущий ввод (может быть полезно если LLM модифицирует его)
        );

      // Добавляем ответ LLM в историю
      // Мы добавляем *весь* результат (включая _type), чтобы сохранить полный контекст решения LLM
      this.addHistoryMessage({
        role: "assistant",
        content: result, // Сохраняем весь объект LLMResult
      });

      // Middleware после ответа LLM
      // Обратите внимание: TOutput здесь может быть неточным, т.к. result может быть Error/CallTool
      // Возможно, стоит типизировать postRunMiddleware более общим типом <unknown> или <LLMResult<any>>
      await aiFunction.postRunMiddleware(result as any); // Используем as any временно

      // Обрабатываем результат LLM
      switch (result._type) {
        case "success":
          // Валидация ответа LLM по схеме функции? (Опционально, но полезно)
          try {
            aiFunction.outputSchema.parse(result._data);
            return result._data as TOutput; // Успех, возвращаем данные
          } catch (validationError) {
            console.error(
              `[smartExecute] LLM output validation failed:`,
              validationError,
            );
            // Добавляем ошибку валидации в историю, чтобы LLM мог исправиться?
            this.addHistoryMessage({
              role: "user", // Сообщение от "системы"
              content: {
                _type: "error",
                _message: `Assistant response validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}. The invalid data was: ${JSON.stringify(result._data)}`,
              },
            });
            // Продолжаем цикл? Или выбрасываем ошибку?
            // Пока продолжим, дадим LLM шанс исправиться на следующей итерации
            // Но если это последняя итерация, нужно выкинуть ошибку
            if (iteration === maxIterations) {
              throw new Error(
                `LLM output validation failed after ${maxIterations} iterations.`,
              );
            }
            // Ничего не возвращаем, цикл продолжится
          }
          break; // Выходим из switch, но не из while (в случае ошибки валидации)

        case "error":
          // LLM сам вернул ошибку
          console.error(
            `[smartExecute] LLM returned an error: ${result._message}`,
          );
          // Можно добавить логику retry здесь или просто пробросить ошибку
          throw new Error(`LLM execution failed: ${result._message}`);

        case "call_tool":
          try {
            // Вызываем инструмент
            const toolResult = await this.callTool(
              functionName,
              result._toolName,
              result._input,
            );

            // Добавляем *успешный* результат инструмента в историю для LLM
            this.addHistoryMessage({
              role: "user", // Представляем результат как новый ввод от "пользователя" (или "окружения")
              toolResponse: {
                toolName: result._toolName,
                toolResponse: toolResult,
              },
            });
            // Продолжаем цикл while для следующего вызова LLM с обновленной историей
          } catch (toolError) {
            // Ошибка выполнения или валидации callTool уже добавлена в историю внутри callTool
            console.error(
              `[smartExecute] Tool call failed: ${toolError instanceof Error ? toolError.message : String(toolError)}. Aborting execution.`,
            );
            // Прерываем выполнение, так как инструмент не смог выполниться
            throw new Error(
              `Tool execution failed for '${result._toolName}': ${toolError instanceof Error ? toolError.message : String(toolError)}`,
            );
          }
          break; // Выходим из switch, цикл while продолжится

        default:
          // Неизвестный тип ответа от LLM
          const unknownType = (result as any)?._type;
          console.error(
            `[smartExecute] Received unknown result type from LLM: ${unknownType}`,
          );
          throw new Error(`Unknown LLM result type: ${unknownType}`);
      }
    } // конец while

    // Если цикл завершился без возврата (достигнут maxIterations)
    throw new Error(
      `[smartExecute] Failed to reach a final answer after ${maxIterations} iterations.`,
    );
  }
}
