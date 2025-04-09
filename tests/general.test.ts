import { describe, test } from "vitest";
import { z } from "zod";
import {
	type AiFunctionDefinition,
	type EventHandler,
	type ExecutionContext,
	type ExecutionEvent,
	ExecutionEventType,
	createAiFunction,
} from "../src";
import { Ai0 } from "./ai0-llm-provider";

describe("General tests", () => {
	test("calculate", async () => {
		class ConsoleEventHandler implements EventHandler {
			publish(event: ExecutionEvent): void {
				console.log("[EVENT HANDLED]", event);
			}
		}

		const CalculatorInputSchema = z.object({
			num1: z.number().describe("Первое число для умножения"),
			num2: z.number().describe("Второе число для умножения"),
		});
		// Выводим тип из схемы
		type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

		const CalculatorOutputSchema = z.object({
			result: z.number().describe("Результат умножения num1 на num2"),
		});
		// Выводим тип из схемы
		type CalculatorOutput = z.infer<typeof CalculatorOutputSchema>;

		const calculatorDefinition: AiFunctionDefinition<
			CalculatorInput,
			CalculatorOutput
		> = {
			functionId: "multiply-calculator", // ID для логов/событий
			inputSchema: CalculatorInputSchema,
			outputSchema: CalculatorOutputSchema,
			// Простой промпт. Инструкции по формату JSON добавятся автоматически.
			promptTemplate:
				"Посчитай произведение двух чисел: {{{num1}}} и {{{num2}}}.",
			// systemPrompt: "Ты - калькулятор. Твоя задача - умножать числа.", // Можно добавить системный промпт
			// outputParser: не указан, используется дефолтный JSON
			retryOptions: { maxAttempts: 2, delayMs: 50 }, // Попробуем 2 раза максимум
		};

		const executionContext: ExecutionContext = {
			llmProvider: new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!),
			eventHandler: new ConsoleEventHandler(), // Добавляем обработчик событий
		};

		const multiplyAiFunction = createAiFunction(
			calculatorDefinition,
			executionContext,
		);

		console.log("\n--- Running AI Calculator Example ---");

		const result = await multiplyAiFunction({
			num1: 2,
			num2: 3,
		});

		console.log(`Result: ${result.result.toString()}`);
		console.log("\n---------------------------------------\n");

		console.log("\n--- Example Finished ---");
	});
});
