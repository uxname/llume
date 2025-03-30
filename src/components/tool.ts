// src/components/tool.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AgentContext } from "../core/agent-context"; // Core context for potential access

/**
 * Abstract base class for defining Tools that the Agent can use.
 * Contains metadata (name, description, schemas) and the core execution logic.
 * Middleware is applied externally via the AgentPipeline.
 */
export abstract class ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown, // Output can be any type, validation happens post-execution
> {
  /** A unique name for the tool (e.g., "GetWeather", "DatabaseQuery"). Should be suitable for LLM calls. */
  public abstract readonly name: string;
  /** A description of the tool's purpose and capabilities. Used in prompts for the LLM. */
  public abstract readonly description: string;
  /** The Zod schema defining the expected input structure for this tool. */
  public abstract readonly inputSchema: TInput;
  /**
   * The Zod schema defining the expected structure of the *successful* output returned by the `execute` method.
   * Used for documentation in prompts and potentially for validation after execution (e.g., in a middleware).
   */
  public abstract readonly outputSchema: z.ZodSchema<TOutput>;

  /**
   * The core logic of the tool. Executes the tool's action based on the input.
   *
   * @param input - The validated input data matching the `inputSchema`.
   * @param context - The current AgentContext, providing access to state, history, etc., if needed.
   * @returns A promise that resolves with the tool's output.
   * @throws {ToolExecutionError} or other specific errors if execution fails.
   */
  public abstract execute(
    input: z.infer<TInput>,
    context: AgentContext, // Provide context for advanced use cases
  ): Promise<TOutput>;

  /**
   * Generates a JSON string representation of the tool's definition,
   * including name, description, and input/output schemas in JSON Schema format.
   * Useful for including in LLM prompts.
   * @returns A JSON string describing the tool.
   */
  public toString(): string {
    try {
      return JSON.stringify({
        name: this.name,
        description: this.description,
        // Convert Zod schemas to JSON Schemas for the prompt
        inputSchema: zodToJsonSchema(this.inputSchema, {
          $refStrategy: "none", // Avoid $refs for simpler LLM consumption
        }),
        outputSchema: zodToJsonSchema(this.outputSchema, {
          $refStrategy: "none",
        }),
      });
    } catch (error) {
      console.error(`Error generating string for tool ${this.name}:`, error);
      return JSON.stringify({
        name: this.name,
        description: `Error generating schema: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
}
