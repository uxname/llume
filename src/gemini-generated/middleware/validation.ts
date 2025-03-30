// src/middleware/validation.ts
import type { MiddlewareFn } from "../types";
import { ValidationError } from "../core";
import { z } from "zod";
import type { LlmResponse } from "../schemas"; // Import common response types

/**
 * Middleware for validating step inputs and outputs against their Zod schemas.
 * - Validates tool input before execution.
 * - Validates LLM input (function input) before execution (can be redundant but safe).
 * - Validates successful LLM output (_data field) after execution.
 * - Validates tool output after execution.
 * Sets `llm-request.error` if validation fails.
 */
export const validationMiddleware: MiddlewareFn = async (context, next) => {
  let validationError: ValidationError | null = null;

  // --- Input Validation ---
  try {
    if (context.request.type === "tool") {
      const toolDef = context.getToolDefinition(context.request.name);
      toolDef.inputSchema.parse(context.request.input);
    } else if (context.request.type === "llm") {
      const funcDef = context.getFunctionDefinition(context.request.name);
      funcDef.inputSchema.parse(context.request.input);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      validationError = new ValidationError(
        `Input validation failed for ${context.request.type} "${context.request.name}"`,
        error.issues,
      );
    } else {
      validationError = new ValidationError(
        `Unexpected error during input validation for ${context.request.type} "${context.request.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (validationError) {
    context.error = validationError;
    // Do not call next() if input validation failed
    return;
  }

  // --- Execute Next Middleware & Handler ---
  await next();

  // --- Output Validation (only if no error occurred during execution) ---
  if (!context.error) {
    try {
      if (context.request.type === "tool") {
        const toolDef = context.getToolDefinition(context.request.name);
        // llm-request.response contains the direct output from tool.execute
        toolDef.outputSchema.parse(context.response);
      } else if (context.request.type === "llm") {
        const llmResponse = context.response as LlmResponse<unknown>; // Cast response
        // Only validate the data part of successful LLM responses
        if (llmResponse?._type === "success") {
          const funcDef = context.getFunctionDefinition(context.request.name);
          funcDef.outputSchema.parse(llmResponse._data);
        }
        // We don't validate 'error' or 'call_tool' responses against function output schema
      }
    } catch (error) {
      // If output validation fails, set llm-request.error
      // The Agent loop needs to handle this specific case for LLM retries.
      if (error instanceof z.ZodError) {
        context.error = new ValidationError(
          `Output validation failed for ${context.request.type} "${context.request.name}"`,
          error.issues,
        );
      } else {
        context.error = new ValidationError(
          `Unexpected error during output validation for ${context.request.type} "${context.request.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // Log the validation error immediately for clarity
      let invalidDataToLog: any;
      if (context.request.type === "llm") {
        const llmResponse = context.response as LlmResponse<unknown>;
        // Only log _data if it was a success response that failed validation
        if (llmResponse?._type === "success") {
          invalidDataToLog = llmResponse._data;
        } else {
          // Log the whole response if it wasn't a success type
          invalidDataToLog = llmResponse;
        }
      } else {
        // For tools, log the direct response
        invalidDataToLog = context.response;
      }

      console.error(
        `[Validation] Output validation failed:`,
        context.error.message,
        (context.error as ValidationError).details,
        "Invalid Output:",
        invalidDataToLog, // Log the correctly determined invalid data
      );
    }
  }
};
