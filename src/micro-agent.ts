import { generateSchema } from "./response-format-constructor.ts";
import { z } from "zod";

export type TemplateVars = { [key: string]: string };
export type MicroAgentResponse<T> = T & { _raw?: unknown };

export abstract class MicroAgent<T = any> {
    protected constructor(
        public readonly name: string,
        public readonly description: string,
        public readonly template: string,
        public readonly vars: TemplateVars,
        public readonly responseSchema: z.ZodType<T>
    ) {}

    // Factory method for easier subclass instantiation
    static create<R, Args extends any[]>(
        this: new (...args: Args) => MicroAgent<R>,
        ...args: Args
    ): MicroAgent<R> {
        return new this(...args);
    }

    // For chaining API calls
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

    // Parse and validate response, returning typed result
    parseResponse(response: unknown): MicroAgentResponse<T> {
        try {
            const parsed = this.responseSchema.parse(response);
            return { ...parsed, _raw: response };
        } catch (error) {
            throw new Error(`Invalid response format: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Simple validation check
    validateResponse(response: unknown): boolean {
        try {
            this.responseSchema.parse(response);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Add helper methods for different LLM services
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

    // Create a new instance with updated variables
    withVars(additionalVars: TemplateVars): this {
        const Constructor = this.constructor as new (
            name: string,
            description: string,
            template: string,
            vars: TemplateVars,
            responseSchema: z.ZodType<T>
        ) => this;

        return new Constructor(
            this.name,
            this.description,
            this.template,
            { ...this.vars, ...additionalVars },
            this.responseSchema
        );
    }

    // Update any property and return new instance
    update(props: Partial<{
        name: string;
        description: string;
        template: string;
        vars: TemplateVars;
    }>): this {
        const Constructor = this.constructor as new (
            name: string,
            description: string,
            template: string,
            vars: TemplateVars,
            responseSchema: z.ZodType<T>
        ) => this;

        return new Constructor(
            props.name ?? this.name,
            props.description ?? this.description,
            props.template ?? this.template,
            props.vars ?? this.vars,
            this.responseSchema
        );
    }

    // Helper method to get formatted template
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