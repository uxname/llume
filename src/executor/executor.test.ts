import { describe, test } from "vitest";
import { z } from "zod";
import { LlmRequest } from "../llm-request/llm-request";
import { Role } from "../llm-request/types";
import { Ai0LlmProvider } from "../llm/providers/ai0/ai0-llm-provider";
import type { BaseTool } from "../tool/base-tool";
import { Executor } from "./executor";
import { Pipeline } from "./pipeline";

describe("Executor", () => {
	test("should execute", async () => {
		const successDataSchema = z.object({
			randomString: z.string().describe("Random 3-4 word sentence"),
			randomNumber: z.number().describe("Random number from 1 to 100"),
			randomName: z.string().describe("Random name"),
		});
		class RandomNumberGeneratorTool implements BaseTool {
			async execute(
				input: z.infer<typeof this.inputSchema>,
			): Promise<z.infer<typeof this.outputSchema>> {
				console.log("RandomNumberGeneratorTool.execute", input);
				return {
					number: Math.floor(
						Math.random() * (input.max - input.min + 1) + input.min,
					),
				};
			}
			readonly name = "Random Number Generator";
			readonly description = "Generates random numbers";
			readonly inputSchema = z.object({
				min: z.number().describe("Minimum value"),
				max: z.number().describe("Maximum value"),
			});
			readonly outputSchema = z.object({
				number: z.number().describe("Random number"),
			});
		}

		const randomNumberGeneratorTool = new RandomNumberGeneratorTool();

		const request = new LlmRequest({
			query: "Generate random data",
			variables: {},
			schema: successDataSchema,
			tools: [randomNumberGeneratorTool],
		});

		request.history.push({
			role: Role.USER,
			content:
				"For the random name - imagine any existing country name (you don't need to use tool for this)",
		});

		request.state = {
			randomString: "Hello world, this is a random string",
		};

		const llm = new Ai0LlmProvider(
			process.env.AI0_URL!,
			process.env.AI0_API_KEY!,
		);

		const executor = new Executor(llm);
		const pipeline = new Pipeline(request);

		const result =
			await executor.execute<z.infer<typeof successDataSchema>>(pipeline);

		console.log("Result:", result);
	});
});
