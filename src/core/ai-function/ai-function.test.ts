import { beforeAll, describe, expect, test } from "vitest";
import { z } from "zod";

import {
	type AiFunctionDefinition,
	type EventHandler,
	type ExecutionContext,
	type ExecutionEvent,
	ExecutionEventType,
	InputValidationError,
	MissingContextError,
	OutputParsingError,
	OutputValidationError,
	PromptCompilationError,
	createAiFunction,
} from "../..";
import { Ai0Provider } from "../../../tests/ai0-llm-provider";

const AI0_URL = process.env.AI0_URL;
const AI0_API_KEY = process.env.AI0_API_KEY;
const areCredentialsProvided = AI0_URL && AI0_API_KEY;

describe.skipIf(!areCredentialsProvided)("AiFunction", () => {
	let executionContext: ExecutionContext;

	beforeAll(() => {
		if (!areCredentialsProvided) {
			console.warn(
				"Skipping AiFunction integration tests: AI0_URL or AI0_API_KEY not set in environment.",
			);
			return;
		}
		executionContext = {
			llmProvider: new Ai0Provider(AI0_URL!, AI0_API_KEY!),
		};
	});

	test("general", async () => {
		const CalculatorInputSchema = z.object({
			expression: z.string(),
		});
		const CalculatorOutputSchema = z.object({
			result: z.object({
				value: z.number().describe("The numerical result of the calculation"),
				comment: z.string().describe("A comment about the calculation"),
			}),
		});

		type InputType = z.infer<typeof CalculatorInputSchema>;
		type OutputType = z.infer<typeof CalculatorOutputSchema>;

		const eventHandler: EventHandler = {
			publish: (event: ExecutionEvent) => {
				if (event.type === ExecutionEventType.PROMPT_COMPILATION_END) {
					console.log(
						"[EVENT HANDLED (COMPILED PROMPT)]\n",
						(event.data as { compiledPrompt: string }).compiledPrompt,
						"\n---------------------------------------\n",
					);
				}
			},
		};

		const executionContext: ExecutionContext = {
			llmProvider: new Ai0Provider(AI0_URL!, AI0_API_KEY!),
			eventHandler: eventHandler,
		};

		const calculatorDefinition: AiFunctionDefinition<InputType, OutputType> = {
			functionId: "calculator",
			inputSchema: CalculatorInputSchema,
			outputSchema: CalculatorOutputSchema,
			userQueryTemplate:
				"Calculate the result of the following mathematical expression: {{{expression}}}",
			promptTemplate: `<|SYSTEM|>
You are a calculator expert.
Отвечай всегда на русском языке.
Respond ONLY with JSON matching this schema: {{{jsonSchema}}}
<|USER|>
Please calculate the following expression: {{{userQuery}}}
<|ASSISTANT|>`,
		};

		const calculate = createAiFunction(calculatorDefinition, executionContext);

		const result = await calculate({
			expression: "2+3",
		});

		console.log(result);
	});

	test("should throw InputValidationError for invalid input", async () => {
		const TranslatorInputSchema = z.object({
			text: z.string().min(1),
			targetLanguage: z.string().default("Spanish").optional(),
		});
		const TranslatorOutputSchema = z.object({
			translation: z.string().min(1),
		});

		type InputType = z.infer<typeof TranslatorInputSchema>;
		type OutputType = z.infer<typeof TranslatorOutputSchema>;

		const translatorDefinition: AiFunctionDefinition<InputType, OutputType> = {
			functionId: "inputValidationTest",
			inputSchema: TranslatorInputSchema,
			outputSchema: TranslatorOutputSchema,
			userQueryTemplate: "Translate: {{{text}}} to {{targetLanguage}}",
		};
		const translate = createAiFunction(translatorDefinition, executionContext);
		const invalidInput = { targetLanguage: "French" };

		// Act & Assert
		// biome-ignore lint/suspicious/noExplicitAny: Intentional invalid input for testing
		await expect(translate(invalidInput as any)).rejects.toThrowError(
			InputValidationError,
		);
		try {
			// biome-ignore lint/suspicious/noExplicitAny: Intentional invalid input for testing
			await translate(invalidInput as any);
		} catch (e) {
			expect(e).toBeInstanceOf(InputValidationError);
			if (e instanceof InputValidationError) {
				console.log(
					"[Test: Input Validation Error] Caught expected error:",
					e.message,
				);
			}
		}
	});

	test("should throw PromptCompilationError if template variable is missing", async () => {
		const SimpleInputSchema = z.object({ name: z.string() });
		type SimpleInput = z.infer<typeof SimpleInputSchema>;
		const SimpleOutputSchema = z.object({ greeting: z.string() });
		type SimpleOutput = z.infer<typeof SimpleOutputSchema>;

		const definition: AiFunctionDefinition<SimpleInput, SimpleOutput> = {
			functionId: "promptCompilationTest",
			inputSchema: SimpleInputSchema,
			outputSchema: SimpleOutputSchema,
			userQueryTemplate: "Greet {{name}} from {{location}}.",
		};
		const greet = createAiFunction(definition, executionContext);
		const validInput: SimpleInput = { name: "Bob" };

		// Act & Assert
		await expect(greet(validInput)).rejects.toThrowError(
			PromptCompilationError,
		);
		try {
			await greet(validInput);
		} catch (e) {
			expect(e).toBeInstanceOf(PromptCompilationError);
			if (e instanceof Error) {
				console.log(
					"[Test: Prompt Compilation Error] Caught expected error:",
					e.message,
				);
			}
		}
	});

	test("should execute successfully using a custom promptTemplate", async () => {
		const SummarizerInputSchema = z.object({
			longText: z.string().min(20),
		});
		type SummarizerInput = z.infer<typeof SummarizerInputSchema>;

		const SummarizerOutputSchema = z.object({
			summary: z.string().min(5).describe("A concise summary"),
		});
		type SummarizerOutput = z.infer<typeof SummarizerOutputSchema>;

		const summarizerDefinition: AiFunctionDefinition<
			SummarizerInput,
			SummarizerOutput
		> = {
			functionId: "customTemplateSummarizer",
			inputSchema: SummarizerInputSchema,
			outputSchema: SummarizerOutputSchema,
			promptTemplate:
				"<|SYSTEM|>You are a text summarization expert. Respond ONLY with JSON matching this schema: {{{jsonSchema}}}<|USER|>Please summarize the following text: {{{userQuery}}}<|ASSISTANT|>",
			userQueryTemplate: "{{{longText}}}",
		};

		const summarize = createAiFunction(summarizerDefinition, executionContext);
		const input: SummarizerInput = {
			longText:
				"Large Language Models are transforming various industries by enabling natural language understanding and generation capabilities previously unseen. They power chatbots, translation services, content creation tools, and much more, driving innovation across the board.",
		};

		// Act
		const result = await summarize(input);

		// Assert
		expect(result).toBeDefined();
		expect(result.summary).toBeTypeOf("string");
		expect(result.summary.length).toBeGreaterThan(5);
		expect(result.summary.length).toBeLessThan(input.longText.length);
		console.log(
			`[Test: Custom Template] Input Length: ${input.longText.length}, Summary:`,
			result,
		);
	});

	test("should throw MissingContextError if context is not provided", async () => {
		const DummySchema = z.object({});
		// biome-ignore lint/suspicious/noExplicitAny: Testing edge case
		const definition: AiFunctionDefinition<any, any> = {
			functionId: "missingContextTest",
			inputSchema: DummySchema,
			outputSchema: DummySchema,
			userQueryTemplate: "Do something.",
		};
		const funcWithoutContext = createAiFunction(definition, undefined);

		// Act & Assert
		await expect(funcWithoutContext({})).rejects.toThrowError(
			MissingContextError,
		);
		try {
			await funcWithoutContext({});
		} catch (e) {
			expect(e).toBeInstanceOf(MissingContextError);
			if (e instanceof Error) {
				console.log(
					"[Test: Missing Context] Caught expected error:",
					e.message,
				);
			}
		}
	});

	test("should potentially throw OutputParsingError if LLM returns non-JSON", async () => {
		const NonJsonInputSchema = z.object({ topic: z.string() });
		type NonJsonInput = z.infer<typeof NonJsonInputSchema>;
		const NonJsonOutputSchema = z.object({ answer: z.string() });
		type NonJsonOutput = z.infer<typeof NonJsonOutputSchema>;

		const definition: AiFunctionDefinition<NonJsonInput, NonJsonOutput> = {
			functionId: "nonJsonOutputTest",
			inputSchema: NonJsonInputSchema,
			outputSchema: NonJsonOutputSchema,
			userQueryTemplate:
				"Tell me a short fun fact about {{topic}}. Do not use JSON format.",
			retryOptions: { maxAttempts: 1 },
		};
		const getFact = createAiFunction(definition, executionContext);
		const input: NonJsonInput = { topic: "cats" };

		// Act & Assert
		try {
			const result = await getFact(input);
			console.warn(
				"[Test: Non-JSON Output] LLM returned valid JSON despite instructions:",
				result,
			);
			expect(result.answer).toBeTypeOf("string");
		} catch (error) {
			expect(error).toBeInstanceOf(OutputParsingError);
			if (error instanceof OutputParsingError) {
				console.log(
					"[Test: Non-JSON Output] Caught expected OutputParsingError:",
					error.message,
				);
				expect(error.rawOutput).toBeTypeOf("string");
			} else {
				console.error(
					"[Test: Non-JSON Output] Caught unexpected error type after expect:",
					error,
				);
				throw error;
			}
		}
	}, 30000);

	test("should potentially throw OutputValidationError if LLM output mismatches schema", async () => {
		const StrictInputSchema = z.object({ question: z.string() });
		type StrictInput = z.infer<typeof StrictInputSchema>;
		const StrictOutputSchema = z.object({
			exactValue: z.literal("MUST_BE_THIS_EXACT_STRING"),
		});
		type StrictOutput = z.infer<typeof StrictOutputSchema>;

		const definition: AiFunctionDefinition<StrictInput, StrictOutput> = {
			functionId: "strictOutputValidationTest",
			inputSchema: StrictInputSchema,
			outputSchema: StrictOutputSchema,
			userQueryTemplate: "Answer the question: {{{question}}}",
			retryOptions: { maxAttempts: 1 },
		};
		const askStrict = createAiFunction(definition, executionContext);
		const input: StrictInput = {
			question: "What is the color of the sky?",
		};

		// Act & Assert
		try {
			const result = await askStrict(input);
			console.warn(
				"[Test: Strict Output Validation] LLM unexpectedly matched the literal:",
				result,
			);
			expect(result.exactValue).toBe("MUST_BE_THIS_EXACT_STRING");
		} catch (error) {
			expect(
				error instanceof OutputValidationError ||
					error instanceof OutputParsingError,
			).toBe(true);

			if (error instanceof OutputValidationError) {
				console.log(
					"[Test: Strict Output Validation] Caught expected OutputValidationError:",
					error.message,
				);
				expect(error.parsedOutput).toBeDefined();
				expect(error.validationErrors).toBeDefined();
			} else if (error instanceof OutputParsingError) {
				console.log(
					"[Test: Strict Output Validation] Caught OutputParsingError instead:",
					error.message,
				);
				expect(error.rawOutput).toBeTypeOf("string");
			} else {
				console.error(
					"[Test: Strict Output Validation] Caught unexpected error type after expect:",
					error,
				);
				throw error;
			}
		}
	}, 30000);
});
