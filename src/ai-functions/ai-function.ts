import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {AiExecutionEngineBase} from "../ai-execution-engine/ai-execution-engine-base.ts";

export type TemplateVars = { [key: string]: string };
export type MicroAgentResponse<T> = T & { _raw?: unknown };

interface ConstructorParams<TSchema extends z.ZodType<any, any, any> = z.ZodType<any, any, any>> {
    description: string;
    name: string;
    template: string;
    responseSchema: TSchema;
    aiExecutionEngine?: AiExecutionEngineBase;
}

export abstract class AiFunction<TSchema extends z.ZodType<any, any, any> = z.ZodType<any, any, any>> {
    public readonly name: string;
    public readonly description: string;
    public readonly template: string;
    public readonly responseSchema: TSchema;
    protected readonly aiExecutionEngine: AiExecutionEngineBase | undefined;
    protected readonly varsSchema: z.ZodType<TemplateVars>;

    protected constructor(data: ConstructorParams<TSchema>) {
        this.name = data.name;
        this.description = data.description;
        this.template = data.template;
        this.responseSchema = data.responseSchema;
        this.aiExecutionEngine = data.aiExecutionEngine;

        // Создаём схему для валидации переменных шаблона,
        // извлекая имена переменных из шаблона
        const requiredKeys = this.extractVariableNames(this.template);
        this.varsSchema = z.object(
            requiredKeys.reduce((acc, key) => {
                acc[key] = z.string().min(1, `Variable '${key}' cannot be empty`);
                return acc;
            }, {} as Record<string, z.ZodString>)
        );
    }

    toPrompt(vars: TemplateVars = {}): string {
        const responseSchema = JSON.stringify(zodToJsonSchema(this.responseSchema));

        const promptTemplate = `${this.template}
Answer format json should according to the following JSON schema: {schema}
Do not send any other data. Do not send markdown.`;

        return this.addVariablesToTemplate(promptTemplate, {
            ...vars,
            schema: responseSchema
        });
    }

    toInfo(): { name: string; description: string; template: string; responseSchema: any } {
        return {
            name: this.name,
            description: this.description,
            template: this.template,
            responseSchema: zodToJsonSchema(this.responseSchema)
        };
    }

    toString(): string {
        return JSON.stringify(this.toInfo());
    }

    parseResponse(response: unknown): MicroAgentResponse<z.infer<TSchema>> {
        try {
            const parsed = this.responseSchema.parse(response);
            return { ...parsed, _raw: response };
        } catch (error) {
            throw new Error(
                `Invalid response format: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async execute(
        vars: TemplateVars,
        aiExecutionEngine?: AiExecutionEngineBase
    ): Promise<MicroAgentResponse<z.infer<TSchema>>> {
        // Валидируем входные переменные
        try {
            this.validateVars(vars);
        } catch (error) {
            throw new Error(
                `Variable validation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        const engine = aiExecutionEngine || this.aiExecutionEngine;
        if (!engine) {
            throw new Error("No LLM provider found");
        }
        const response = await engine.execute({
            prompt: this.toPrompt(vars),
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
        this.varsSchema.parse(vars);
    }

    private extractVariableNames(template: string): string[] {
        const matches = template.match(/\{(\w+)}/g) || [];
        return matches
            .map(match => match.substring(1, match.length - 1))
            .filter(key => key !== "schema"); // Исключаем переменную "schema", которая добавляется автоматически
    }
}
