import { generateSchema } from "./response-format-constructor.ts";
import { z } from "zod";

export type TemplateVars = { [key: string]: string };
export type MicroAgentResponse<T> = T & { _raw?: unknown };
export type MicroAgentConfig<T> = {
    name: string;
    description: string;
    template: string;
    vars: TemplateVars;
    responseSchema: z.ZodType<T>;
};

export abstract class MicroAgent<T = any> {
    public readonly name: string;
    public readonly description: string;
    public readonly template: string;
    public readonly vars: TemplateVars;
    public readonly responseSchema: z.ZodType<T>;

    protected constructor(config: MicroAgentConfig<T>) {
        this.name = config.name;
        this.description = config.description;
        this.template = config.template;
        this.vars = config.vars;
        this.responseSchema = config.responseSchema;
    }

    static create<R, Args extends any[]>(
        this: new (...args: Args) => MicroAgent<R>,
        ...args: Args
    ): MicroAgent<R> {
        return new this(...args);
    }

    toPrompt(): string {
        const responseSchema = JSON.stringify(generateSchema(this.responseSchema));

        const promptTemplate = `${this.template}
Answer format json should according to the following JSON schema: {schema}
Do not send any other data. Do not send markdown.`;

        return this.addVariablesToTemplate(promptTemplate, {
            schema: responseSchema
        });
    }

    toInfo(): { name: string; description: string; template: string; responseSchema: any } {
        return {
            name: this.name,
            description: this.description,
            template: this.template,
            responseSchema: generateSchema(this.responseSchema)
        };
    }

    parseResponse(response: unknown): MicroAgentResponse<T> {
        try {
            const parsed = this.responseSchema.parse(response);
            return { ...parsed, _raw: response };
        } catch (error) {
            throw new Error(`Invalid response format: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    validateResponse(response: unknown): boolean {
        try {
            this.responseSchema.parse(response);
            return true;
        } catch (error) {
            return false;
        }
    }

    async execute<R = T>(
        llmService: { generateResponse: (params: any) => Promise<any> },
        provider: string = 'default',
        options: Record<string, any> = {}
    ): Promise<MicroAgentResponse<T>> {
        const response = await llmService.generateResponse({
            microAgent: this,
            provider,
            ...options
        });

        return this.parseResponse(response);
    }

    withVars(additionalVars: TemplateVars): this {
        const Constructor = this.constructor as new (config: MicroAgentConfig<T>) => this;

        return new Constructor({
            name: this.name,
            description: this.description,
            template: this.template,
            vars: { ...this.vars, ...additionalVars },
            responseSchema: this.responseSchema
        });
    }

    update(props: Partial<{
        name: string;
        description: string;
        template: string;
        vars: TemplateVars;
    }>): this {
        const Constructor = this.constructor as new (config: MicroAgentConfig<T>) => this;

        return new Constructor({
            name: props.name ?? this.name,
            description: props.description ?? this.description,
            template: props.template ?? this.template,
            vars: props.vars ?? this.vars,
            responseSchema: this.responseSchema
        });
    }

    protected addVariablesToTemplate(prompt: string, additionalVars?: TemplateVars): string {
        const allVars = { ...this.vars, ...(additionalVars || {}) };

        return prompt.replace(/\{(\w+)}/g, (match, key) => {
            if (key in allVars) {
                return allVars[key];
            }
            console.warn(`Key "${key}" not found in vars.`);
            return match;
        });
    }
}