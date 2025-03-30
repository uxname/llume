// src/types/middleware.ts

// Import AgentContext type carefully to avoid runtime circular dependencies
// This is generally safe as it's only used for type information.
import type { AgentContext } from "../core/agent-context";

/**
 * Function signature for the 'next' function passed to middleware.
 * Calling this function invokes the next middleware in the chain, or ultimately,
 * the final step handler (LLM call or Tool execution).
 * It returns a Promise that resolves when the downstream middleware/handler completes.
 */
export type NextFunction = () => Promise<void>;

/**
 * Function signature for a middleware function within the Agent pipeline.
 * Middleware can inspect and modify the `context`, perform actions, and control
 * the flow by calling `next()`.
 *
 * @template TState - The type of the agent's state object. Defaults to any record.
 * @template TInput - The type of the input for the current step. Defaults to unknown.
 * @template TOutput - The type of the output for the current step. Defaults to unknown.
 * @param context - The AgentContext object containing all information about the current step.
 *                  Middleware functions should generally handle generic contexts unless specifically designed
 *                  for a particular agent/step type. Using `any` for generics allows broader applicability.
 * @param next - The function to call to pass control to the next middleware or the final handler.
 *               Must be awaited if the middleware needs to perform actions after the step completes.
 */
export type MiddlewareFn<
  TState extends Record<string, any> = Record<string, any>,
  TInput = unknown,
  TOutput = unknown,
> = (
  context: AgentContext<TState, TInput, TOutput>,
  next: NextFunction,
) => Promise<void>;

// Example of a more specific middleware type if needed, though less common:
// export type SpecificMiddlewareFn = MiddlewareFn<MySpecificState, MySpecificInput, MySpecificOutput>;
