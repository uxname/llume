import type { LlmRequest } from "../llm-request.ts";
import { PromptHelper } from "../../prompt/prompt-helper.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LlmResponseSchema } from "../../llm-response/schemas.ts";

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
    });
  }
}
