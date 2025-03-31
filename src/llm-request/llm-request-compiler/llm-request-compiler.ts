import type { LlmRequest } from "../llm-request";
import { PromptHelper } from "../../prompt/prompt-helper";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LlmResponseSchema } from "../../llm-response/schemas";

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

    return PromptHelper.compile(prompt, {
      userQuery: request.userQuery,
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
