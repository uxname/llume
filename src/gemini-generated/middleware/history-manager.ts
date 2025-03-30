// src/middleware/historyManager.ts
import type { MiddlewareFn } from "../types";
import type { HistoryMessage, ToolResponsePayload } from "../components";
import type { LlmResponse } from "../schemas";

/**
 * Middleware responsible for adding messages to the conversation history
 * after a step successfully completes.
 * - Adds 'assistant' message after successful LLM response.
 * - Adds 'user' message with 'toolResponse' after successful Tool execution.
 */
export const historyManagerMiddleware: MiddlewareFn = async (context, next) => {
  // Execute the rest of the pipeline first
  await next();

  // Only add to history if the step completed without errors
  if (!context.error && context.response !== undefined) {
    let messageToAdd: HistoryMessage | null = null;

    if (context.request.type === "llm") {
      // LLM step finished, add assistant response
      const llmResponse = context.response as LlmResponse<unknown>;
      messageToAdd = {
        role: "assistant",
        content: llmResponse, // Add the entire parsed LLM response object
      };
    } else if (context.request.type === "tool") {
      // Tool step finished, add tool response as a user message
      const toolResponsePayload: ToolResponsePayload = {
        toolName: context.request.name,
        // llm-request.response contains the direct output from tool.execute
        // It should match the tool's output schema if validation passed
        toolResponse: context.response as any, // Cast needed as response type is generic
      };
      messageToAdd = {
        role: "user", // Tool responses are treated as user input for the next LLM turn
        toolResponse: toolResponsePayload,
        // Content is typically undefined when toolResponse is present
      };
    }

    if (messageToAdd) {
      try {
        context.history.addMessage(messageToAdd);
      } catch (error) {
        console.error(
          "[HistoryManager] Failed to add message to history:",
          error,
          "Message:",
          messageToAdd,
        );
        // Optionally set llm-request.error here if history failure is critical
        // llm-request.error = new AgentError("Failed to update history");
      }
    }
  }
  // If llm-request.error exists, we typically don't add the failed response automatically.
  // Error handling logic (either in Agent or another middleware) might add
  // specific error messages to the history if needed for retries.
};
