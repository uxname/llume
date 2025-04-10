import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
	type AiFunctionDefinition,
	type EventHandler,
	type ExecutionContext,
	type ExecutionEvent,
	ExecutionEventType,
	createAiFunction,
} from "../src";
import { Ai0Provider } from "./ai0-llm-provider";

class ConsoleEventHandler implements EventHandler {
	publish(event: ExecutionEvent): void {
		if (event.type === ExecutionEventType.PROMPT_COMPILATION_END) {
			console.log(
				"[EVENT HANDLED (COMPILED PROMPT)]\n",
				(event.data as { compiledPrompt: string }).compiledPrompt,
				"\n---------------------------------------\n",
			);
		} else if (event.type === ExecutionEventType.AI_FUNCTION_END) {
			console.log("[EVENT HANDLED (RESULT)]", event.data);
		} else {
			console.log("[EVENT HANDLED]", event.type, event.data);
		}
	}
}

describe("General AiFunction tests", () => {
	test("should execute a simple calculation task", async () => {
		const CalculatorInputSchema = z.object({
			expression: z.string(),
		});
		type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

		const CalculatorOutputSchema = z.object({
			result: z.number().describe("The numerical result of the calculation"),
		});
		type CalculatorOutput = z.infer<typeof CalculatorOutputSchema>;

		const calculatorDefinition: AiFunctionDefinition<
			CalculatorInput,
			CalculatorOutput
		> = {
			functionId: "calculator",
			inputSchema: CalculatorInputSchema,
			outputSchema: CalculatorOutputSchema,
			userQueryTemplate:
				"Calculate the result of the following mathematical expression: {{{expression}}}",
			retryOptions: { maxAttempts: 2, delayMs: 100 },
		};

		const executionContext: ExecutionContext = {
			llmProvider: new Ai0Provider(
				process.env.AI0_URL!,
				process.env.AI0_API_KEY!,
			),
			eventHandler: new ConsoleEventHandler(),
		};

		const calculate = createAiFunction(calculatorDefinition, executionContext);

		console.log("\n--- Running AI Calculator Example ---");

		const input: CalculatorInput = { expression: "10 * (5 + 3)" };
		const result = await calculate(input);
		const result2 = await calculate(input);

		console.log(`Input Expression: ${input.expression}`);
		console.log(`Calculation Result: ${result.result}`);
		console.log(`Calculation Result 2: ${result2.result}`);
		console.log("---------------------------------------\n");

		expect(result.result).toBeTypeOf("number");
		// We can't guarantee the exact result from the LLM, but we expect a number
	});

	test("should use custom promptTemplate", async () => {
		const GreeterInputSchema = z.object({
			name: z.string(),
			language: z.string().default("English").optional(),
		});
		type GreeterInput = z.infer<typeof GreeterInputSchema>;

		const GreeterOutputSchema = z.object({
			greeting: z.string(),
		});
		type GreeterOutput = z.infer<typeof GreeterOutputSchema>;

		const greeterDefinition: AiFunctionDefinition<GreeterInput, GreeterOutput> =
			{
				functionId: "greeter",
				inputSchema: GreeterInputSchema,
				outputSchema: GreeterOutputSchema,
				promptTemplate: `<|system|>You are a friendly greeter. Respond in {{language}}. Output JSON only. JSON Schema: {{{jsonSchema}}}<|end|>
<|user|>{{{userQuery}}}<|end|>
<|assistant|>`,
				userQueryTemplate: "Generate a greeting for {{name}}.",
			};

		const executionContext: ExecutionContext = {
			llmProvider: new Ai0Provider(
				process.env.AI0_URL!,
				process.env.AI0_API_KEY!,
			),
			eventHandler: new ConsoleEventHandler(),
		};

		const greet = createAiFunction(greeterDefinition, executionContext);

		console.log("\n--- Running AI Greeter Example (Custom Template) ---");
		const input: GreeterInput = { name: "Alice", language: "Spanish" };
		const result = await greet(input);

		console.log(`Input: Name=${input.name}, Language=${input.language}`);
		console.log(`Greeting Result: ${result.greeting}`);
		console.log("---------------------------------------\n");

		expect(result.greeting).toBeTypeOf("string");
	});
});
