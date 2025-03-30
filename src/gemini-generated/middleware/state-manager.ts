// src/middleware/stateManager.ts
import type { MiddlewareFn } from "../types";
import pc from "picocolors"; // Optional: for colored logging
// For more robust comparison, consider a library like 'fast-deep-equal'
// import equal from 'fast-deep-equal';
// Simple JSON comparison (less robust for object key order, undefined, functions)
const simpleJsonEqual = (a: any, b: any): boolean => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false; // Cannot stringify (e.g., circular refs), assume not equal
  }
};

/**
 * Middleware to monitor and log changes to the `llm-request.state`.
 * It compares the state before and after the subsequent middleware and handler run.
 * Useful for debugging state modifications during agent execution.
 */
export const stateChangeLoggerMiddleware: MiddlewareFn = async (
  context,
  next,
) => {
  // Deep clone the state before the step executes
  // Using structuredClone for a standard deep copy mechanism
  let stateBefore: typeof context.state;
  try {
    stateBefore = structuredClone(context.state);
  } catch (e) {
    console.warn(
      pc.yellow(
        "[StateManager] Could not clone state before step, logging disabled for this step.",
      ),
      e,
    );
    await next(); // Still execute the rest of the chain
    return;
  }

  // Execute the rest of the pipeline (other middleware and the final handler)
  await next();

  // State after execution (might have been modified)
  const stateAfter = context.state;

  // Compare state before and after
  // Replace simpleJsonEqual with a more robust deep comparison if needed
  if (!simpleJsonEqual(stateBefore, stateAfter)) {
    const stepId = `${context.request.type}:${context.request.name}`;
    console.log(
      pc.cyan(`[${stepId}] State changed:`),
      // Provide both states for comparison, or implement a diff logger
      // For simplicity, just logging the new state:
      JSON.stringify(stateAfter, null, 2),
      // Or log both:
      // { before: stateBefore, after: stateAfter }
    );
  }
  // If state didn't change, no log message is printed by this middleware.
};

/**
 * Placeholder for a potential state validation middleware.
 * This is less common but could be implemented if needed.
 */
/*
import { z } from 'zod';
export const createStateValidatorMiddleware = (stateSchema: z.ZodSchema): MiddlewareFn => {
    return async (llm-request, next) => {
        // Validate state *before*? Usually not needed.

        await next();

        // Validate state *after* the step, only if no error occurred
        if (!llm-request.error) {
            try {
                stateSchema.parse(llm-request.state);
            } catch (error) {
                if (error instanceof z.ZodError) {
                     llm-request.error = new ValidationError(
                        `State validation failed after step ${llm-request.request.type}:${llm-request.request.name}`,
                        error.issues
                    );
                     console.error(
                        pc.red(`[StateValidator] State validation failed:`),
                        llm-request.error.message,
                        (llm-request.error as ValidationError).details
                    );
                } else {
                    // Handle unexpected validation errors
                }
            }
        }
    };
};
*/
