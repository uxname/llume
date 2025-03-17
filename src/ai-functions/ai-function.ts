import {z} from "zod";
import type {BaseLLMProvider} from "../llm-provider/base-llm-provider.ts";
import {zodToJsonSchema} from "zod-to-json-schema";

export type TemplateVars = { [key: string]: string };
export type MicroAgentResponse<T> = T & { _raw?: unknown };

interface ConstructorParams<T = any> {
    description: string;
    name: string;
    template: string
    responseSchema: z.ZodType<T>;
    llmProvider?: BaseLLMProvider;
}

export abstract class AiFunction<T = any> {
    public readonly name: string;
    public readonly description: string;
    public readonly template: string;
    public readonly responseSchema: z.ZodType<T>;
    protected readonly llmProvider: BaseLLMProvider | undefined;
    protected readonly varsSchema: z.ZodType<TemplateVars>;

    protected constructor(data: ConstructorParams) {
        this.name = data.name;
        this.description = data.description;
        this.template = data.template;
        this.responseSchema = data.responseSchema;
        this.llmProvider = data.llmProvider;

        // Create a schema to validate template variables by extracting variable names from the template
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

    parseResponse(response: unknown): MicroAgentResponse<T> {
        try {
            const parsed = this.responseSchema.parse(response);
            return {...parsed, _raw: response};
        } catch (error) {
            throw new Error(`Invalid response format: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async execute(vars: TemplateVars, llmProvider?: BaseLLMProvider): Promise<MicroAgentResponse<T>> {
        // Validate input variables against the schema
        try {
            this.validateVars(vars);
        } catch (error) {
            throw new Error(`Variable validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        const provider = llmProvider || this.llmProvider;
        if (!provider) {
            throw new Error('No LLM provider found');
        }
        const response = await provider.query({
            prompt: this.toPrompt(vars),
        });

        // log request and response
        // console.log(`Execute [${this.name}]:\n${JSON.stringify(vars,null,2)}\nResponse: ${JSON.stringify(response)}\n`);
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
            .filter(key => key !== 'schema'); // Exclude the 'schema' variable which is added internally
    }
}