import { describe, test } from "vitest";
import { z } from "zod";
import { Ai0LlmProvider } from "../../llm/providers/ai0/ai0-llm-provider.ts";
import type { BaseTool } from "../../tool/base-tool.ts";
import { LlmRequest } from "../llm-request.ts";
import { Role } from "../types.ts";
import { LlmRequestCompiler } from "./llm-request-compiler.ts";

describe("LlmRequestCompiler", () => {
	test("should compile", async () => {
		const successDataSchema = z.object({
			randomString: z.string().describe("Random 3-4 word sentence"),
			randomNumber: z.number().describe("Random number from 1 to 100"),
			randomName: z.string().describe("Random name"),
		});
		class RandomNumberGeneratorTool implements BaseTool {
			async execute(
				input: z.infer<typeof this.inputSchema>,
			): Promise<z.infer<typeof this.outputSchema>> {
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
				"For the random name - generate a random existing country name (do not use tool for this)",
		});

		request.state = {
			randomString: "Hello world, this is a random string",
		};

		request.toolsCallHistory = [
			{
				toolName: randomNumberGeneratorTool.name,
				toolInput: {
					min: 1,
					max: 100,
				},
				toolOutput: {
					number: 77,
				},
			},
		];

		const compiledRequest = LlmRequestCompiler.compile(request);
		console.log(
			compiledRequest,
			"\n------------------------------------------------",
		);

		const llm = new Ai0LlmProvider(
			process.env.AI0_URL!,
			process.env.AI0_API_KEY!,
		);

		const response = await llm.execute(compiledRequest);
		console.log(response);
	});
});
