// src/components/ai-function.ts
import { z } from "zod";
import type { PromptTemplate } from "../prompts"; // Assuming PromptTemplate exists

/**
 * Represents the static definition of an AI Function.
 * Contains metadata like name, description, schemas, and the prompt template,
 * but no execution logic or middleware references itself.
 */
export class AiFunctionDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** A unique name for the AI function (e.g., "WeatherReporter", "CodeGenerator"). */
  public readonly name: string;
  /** A brief description of what the AI function does. Used in prompt or documentation. */
  public readonly description: string;
  /** The Zod schema defining the expected input structure for this function. */
  public readonly inputSchema: TInput;
  /** The Zod schema defining the expected structure of the *successful* output (_data field) from this function. */
  public readonly outputSchema: TOutput;
  /** The template used to generate the primary query or instruction for the LLM. */
  public readonly promptTemplate: PromptTemplate;

  constructor(params: {
    name: string;
    description: string;
    inputSchema: TInput;
    outputSchema: TOutput;
    promptTemplate: PromptTemplate;
  }) {
    this.name = params.name;
    this.description = params.description;
    this.inputSchema = params.inputSchema;
    this.outputSchema = params.outputSchema;
    this.promptTemplate = params.promptTemplate;
  }
}
