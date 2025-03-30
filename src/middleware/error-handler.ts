// src/middleware/errorHandler.ts
import type { MiddlewareFn } from "../types";
import { AgentError } from "../core";
import pc from "picocolors"; // Optional: for colored logging

/**
 * Middleware to catch errors occurring in subsequent middleware or the final handler.
 * It ensures that any thrown error is captured and placed into `context.error`.
 * Should typically be placed early in the middleware chain.
 */
export const errorHandlerMiddleware: MiddlewareFn = async (context, next) => {
  try {
    await next(); // Execute subsequent middleware and the final handler
  } catch (err) {
    // If an error is thrown, capture it in the context
    if (!context.error) {
      // Avoid overwriting an error potentially set by earlier middleware
      context.error = err instanceof Error ? err : new AgentError(String(err));
      console.error(
        pc.red(
          `[ErrorHandler] Caught error during ${context.request.type}:${context.request.name}:`,
        ),
        context.error.message,
        // Optionally log stack trace for debugging
        // context.error.stack
      );
    } else {
      // An error was already set, maybe log that this new error was suppressed?
      console.warn(
        pc.yellow(
          `[ErrorHandler] Suppressed subsequent error because context.error already existed. Suppressed:`,
        ),
        err,
      );
    }
    // We don't re-throw; the Agent loop will check context.error
  }
};
