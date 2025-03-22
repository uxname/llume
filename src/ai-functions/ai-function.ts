import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AiExecutionEngineBase } from "../ai-execution-engine/ai-execution-engine-base.ts";
import { Prompt } from "../prompt/prompt.ts";

export type TemplateVars = { [key: string]: string };
export type MicroAgentResponse<T> = T & { _raw?: unknown };

interface ConstructorParams<
  TSchema extends z.ZodType<any, any, any> = z.ZodType<any, any, any>,
> {
  description: string;
  name: string;
  prompt: Prompt;
  responseSchema: TSchema;
  aiExecutionEngine?: AiExecutionEngineBase;
}

export abstract class AiFunction<
  TSchema extends z.ZodType<any, any, any> = z.ZodType<any, any, any>,
> {
  public readonly name: string;
  public readonly description: string;
  public readonly prompt: Prompt;
  public readonly responseSchema: TSchema;
  protected readonly aiExecutionEngine: AiExecutionEngineBase | undefined;

  protected constructor(data: ConstructorParams<TSchema>) {
    this.name = data.name;
    this.description = data.description;
    this.prompt = data.prompt;
    this.responseSchema = data.responseSchema;
    this.aiExecutionEngine = data.aiExecutionEngine;
  }

  render(vars: TemplateVars = {}): string {
    const responseSchema = JSON.stringify(zodToJsonSchema(this.responseSchema));

    const prompt = new Prompt(`{prompt}
Answer format json should according to the following JSON schema:
{schema}
Do not send any other data. Do not send markdown.`);

    return prompt.render({
      ...vars,
      prompt: this.prompt,
      schema: responseSchema,
    });
  }

  toJson(): {
    name: string;
    description: string;
    prompt: string;
    responseSchema: any;
  } {
    return {
      name: this.name,
      description: this.description,
      prompt: this.prompt.getTemplate(),
      responseSchema: zodToJsonSchema(this.responseSchema),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJson());
  }

  parseResponse(response: unknown): MicroAgentResponse<z.infer<TSchema>> {
    try {
      const parsed = this.responseSchema.parse(response);
      return { ...parsed, _raw: response };
    } catch (error) {
      throw new Error(
        `Invalid response format: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async execute(
    vars: TemplateVars,
    aiExecutionEngine?: AiExecutionEngineBase,
  ): Promise<MicroAgentResponse<z.infer<TSchema>>> {
    this.validateVars(vars);

    const engine = aiExecutionEngine || this.aiExecutionEngine;
    if (!engine) {
      throw new Error("No LLM provider found");
    }
    const response = await engine.execute({
      prompt: this.render(vars),
    });

    console.log(`Execute [${this.name}]: ${JSON.stringify(response)}\n`);

    return this.parseResponse(response);
  }

  protected addVariablesToTemplate(prompt: string, vars: TemplateVars): string {
    return prompt.replace(/\{(\w+)}/g, (match, key) => {
      if (key in vars) {
        return vars[key];
      }
      console.warn(`Key "${key}" not found in vars.`);
      return match;
    });
  }

  protected validateVars(vars: TemplateVars): void {
    const renderedPrompt = this.render(vars);
    const isFullyRendered = this.prompt.isFullyRendered(renderedPrompt);
    if (!isFullyRendered) {
      const missingVariables = this.extractVariableNames(renderedPrompt);
      throw new Error(`Missing variables: ${missingVariables.join(", ")}`);
    }
  }

  private extractVariableNames(template: string): string[] {
    const matches = template.match(/\{(\w+)}/g) || [];
    return matches
      .map((match) => match.substring(1, match.length - 1))
      .filter((key) => key !== "schema"); // Исключаем переменную "schema", которая добавляется автоматически
  }
}
