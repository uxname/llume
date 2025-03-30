// src/middleware/logging.ts
import type { MiddlewareFn } from "../types";
import pc from "picocolors"; // For colored output

/**
 * Middleware for logging the request and response/error of each step.
 * Provides visibility into the agent's execution flow.
 */
export const loggingMiddleware: MiddlewareFn = async (context, next) => {
  const stepId = `${context.request.type}:${context.request.name}`;
  const startTime = Date.now();

  console.log(
    pc.blue(`[${stepId}] --> Request:`),
    JSON.stringify(context.request.input, null, 2),
  );
  // Optional: Log current state before step
  // console.log(pc.dim(`[${stepId}] State before: ${JSON.stringify(context.state)}`));

  await next(); // Execute the rest of the pipeline

  const duration = Date.now() - startTime;

  if (context.error) {
    console.error(
      pc.red(`[${stepId}] <-- Error (${duration}ms):`),
      context.error.message,
      // Optionally log the full error object for more details
      // context.error
    );
  } else {
    console.log(
      pc.green(`[${stepId}] <-- Response (${duration}ms):`),
      JSON.stringify(context.response, null, 2),
    );
    // Optional: Log state after step
    // console.log(pc.dim(`[${stepId}] State after: ${JSON.stringify(context.state)}`));
  }
};
