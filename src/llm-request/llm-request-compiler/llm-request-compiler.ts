import { zodToJsonSchema } from "zod-to-json-schema";
import { LlmResponseSchema } from "../../llm-response/schemas";
import { PromptHelper } from "../../prompt/prompt-helper";
import type { LlmRequest } from "../llm-request";

export class LlmRequestCompiler {
	static compile(request: LlmRequest): string {
		const prompt = PromptHelper.loadSystemPrompt();

		const responseSchema = LlmResponseSchema(request.successResponseSchema);

		const tools = request.tools?.map((tool) =>
			JSON.stringify({
				name: tool.name,
				description: tool.description,
				inputSchema: zodToJsonSchema(tool.inputSchema),
				outputSchema: zodToJsonSchema(tool.outputSchema),
			}),
		);

		const compiledQuery = PromptHelper.compile(
			request.query,
			request.variables,
		);

		return PromptHelper.compile(prompt, {
			userQuery: compiledQuery,
			responseSchema: JSON.stringify(zodToJsonSchema(responseSchema)),
			tools: tools?.join("\n"),
			state: JSON.stringify(request.state),
			toolsCallHistory: JSON.stringify(request.toolsCallHistory),
			history:
				request.history?.length > 0
					? JSON.stringify(request.history)
					: undefined,
		});
	}
}
