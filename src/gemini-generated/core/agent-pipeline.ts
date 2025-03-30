// src/core/agent-pipeline.ts
import type { MiddlewareFn } from "../types/middleware.ts";
import type { AgentContext } from "./agent-context.ts";

/**
 * Represents the final handler function that executes the core logic
 * of a step (e.g., calling the LLM or executing a tool) after all
 * middleware have run.
 */
export type FinalHandlerFn = (context: AgentContext) => Promise<void>;

/**
 * Manages and executes a chain of middleware functions for a single Agent step.
 * Follows a pattern similar to Express.js middleware.
 */
export class AgentPipeline {
  private readonly middlewares: MiddlewareFn[] = [];

  /**
   * Adds a middleware function to the pipeline.
   * Middleware are executed in the order they are added.
   * @param middleware - The middleware function to add.
   */
  public use(middleware: MiddlewareFn): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Executes the middleware chain for the given context.
   * After all middleware complete, the `finalHandler` is called.
   * Catches errors during middleware execution or final handling and stores them in `context.error`.
   *
   * @param context - The AgentContext for the current step.
   * @param finalHandler - The function to execute the core step logic (LLM call or Tool execution).
   */
  public async run(
    context: AgentContext,
    finalHandler: FinalHandlerFn,
  ): Promise<void> {
    let index = -1;

    // Define the dispatch function that calls the next middleware or the final handler
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        // Prevent calling next() multiple times within the same middleware
        throw new Error("next() called multiple times");
      }
      index = i;

      const middleware = this.middlewares[i];

      if (middleware) {
        // Call the current middleware, passing context and the next dispatcher
        await middleware(context, () => dispatch(i + 1));
      } else {
        // End of middleware chain, call the final handler
        await finalHandler(context);
      }
    };

    try {
      // Start the dispatch chain from the first middleware
      await dispatch(0);
    } catch (err) {
      // Catch any error thrown by middleware or the final handler
      context.error = err instanceof Error ? err : new Error(String(err));
      // Optionally re-throw, log, or let the Agent handle the context.error
      // console.error("Error during pipeline execution:", context.error);
    }
  }

  /**
   * Returns a copy of the middleware array currently in the pipeline.
   */
  public getMiddlewares(): MiddlewareFn[] {
    return [...this.middlewares];
  }
}
