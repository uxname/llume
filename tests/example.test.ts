import { describe, expect, test } from "vitest";
import { z } from "zod";

// Импортируем основные компоненты из главного экспортного файла
import {
  Agent,
  AiFunctionDefinition,
  PromptTemplate,
  Ai0Llm,
  // Типы ошибок для возможной проверки
  // AgentError, ValidationError, LlmError
} from "../src/gemini-generated";

// Импортируем стандартные мидлвары (можно импортировать и из '../src' если они там экспортируются)
import {
  errorHandlerMiddleware,
  loggingMiddleware,
  validationMiddleware,
  historyManagerMiddleware,
  stateChangeLoggerMiddleware,
} from "../src/gemini-generated"; // Убедитесь, что пути корректны

// Проверка наличия переменных окружения (Vitest должен их загрузить через dotenv/config)
if (!process.env.AI0_URL || !process.env.AI0_API_KEY) {
  throw new Error(
    "Не найдены переменные окружения AI0_URL или AI0_API_KEY, необходимые для тестов.",
  );
}

describe("Agent End-to-End Tests", () => {
  test("should execute a simple function without tools", async () => {
    // 1. Определение схем и типов
    const inputSchema = z.object({
      num1: z.number().describe("Первое число"),
      num2: z.number().describe("Второе число"),
    });
    const outputSchema = z.object({
      sum: z.number().describe("Сумма num1 и num2"),
    });
    type Input = z.infer<typeof inputSchema>;
    type Output = z.infer<typeof outputSchema>;

    // 2. Определение AI Функции
    const adderPrompt = new PromptTemplate(
      "Вычисли сумму {{num1}} и {{num2}}. Ответь только JSON объектом, содержащим результат в поле _data.sum.",
    );
    const simpleAdderDefinition = new AiFunctionDefinition({
      name: "SimpleAdder",
      description: "Складывает два числа из входных данных.",
      inputSchema: inputSchema,
      outputSchema: outputSchema,
      promptTemplate: adderPrompt,
    });

    // 3. Настройка LLM и Агента
    const llm = new Ai0Llm(process.env.AI0_URL!, process.env.AI0_API_KEY!);
    const agent = new Agent(llm); // Используем конфигурацию по умолчанию

    // 4. Добавление Мидлваров (порядок важен)
    agent.use(errorHandlerMiddleware); // Ловит ошибки следующих мидлваров/обработчика
    agent.use(loggingMiddleware); // Логирует запросы/ответы (полезно для отладки теста)
    agent.use(validationMiddleware); // Валидирует вход/выход
    agent.use(historyManagerMiddleware); // Добавляет сообщения в историю
    agent.use(stateChangeLoggerMiddleware); // Логирует изменения состояния (если они будут)

    // 5. Регистрация Функции
    agent.addFunction(simpleAdderDefinition);

    // 6. Выполнение
    const inputData: Input = { num1: 15, num2: 27 };
    const result = await agent.execute<Input, Output>(
      simpleAdderDefinition.name,
      inputData,
    );

    // 7. Проверки (Assertions)
    expect(result).toBeDefined();
    expect(result).toHaveProperty("sum");
    expect(result.sum).toBe(42); // 15 + 27 = 42

    console.log("Результат теста SimpleAdder:", result); // Опционально: вывести результат в консоль
  });

  // --- Сюда можно добавить другие тесты ---
  // Например:
  // - тест с использованием инструмента
  // - тест с изменением состояния через мидлвар или инструмент
  // - тест обработки ошибок (например, невалидный ввод, ошибка LLM)
  // test('should execute a function that uses a tool', async () => { /* ... */ });
  // test('should handle LLM output validation failure and retry', async () => { /* ... */ });
});
