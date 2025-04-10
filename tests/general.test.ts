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
				if (event.type === ExecutionEventType.PROMPT_COMPILATION_END) {
					console.log(
						"[EVENT HANDLED (COMPILED PROMPT)]",
						event.data.compiledPrompt,
					);
				} else {
					console.log("[EVENT HANDLED]", event);
				}
			}
		}

		const CalculatorInputSchema = z.object({
			expression: z.string(),
		});
		// Выводим тип из схемы
		type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

		const CalculatorOutputSchema = z.object({
			result: z.number().describe("Результат вычисления"),
		});
		// Выводим тип из схемы
		type CalculatorOutput = z.infer<typeof CalculatorOutputSchema>;

		const calculatorDefinition: AiFunctionDefinition<
			CalculatorInput,
			CalculatorOutput
		> = {
			functionId: "calculator", // ID для логов/событий
			inputSchema: CalculatorInputSchema,
			outputSchema: CalculatorOutputSchema,
			// Простой промпт. Инструкции по формату JSON добавятся автоматически.
			userQueryTemplate: "Посчитай следующее выражение: {{{expression}}}",
			// outputParser: не указан, используется дефолтный JSON
			retryOptions: { maxAttempts: 3, delayMs: 200 }, // Попробуем 2 раза максимум
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
			expression: "2+2",
		});

		console.log(`Result: ${result.result.toString()}`);
		console.log("\n---------------------------------------\n");

		console.log("\n--- Example Finished ---");
	});
});
