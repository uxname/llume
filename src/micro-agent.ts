import { generateSchema } from "./response-format-constructor.ts";
import { z } from "zod";

export type TemplateVars = { [key: string]: string };

export abstract class MicroAgent {
    protected constructor(
        public readonly name: string,
        public readonly description: string,
        public readonly template: string,
        public readonly vars: TemplateVars,
        public readonly responseSchema: z.ZodType
    ) {
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

    toInfo(): string {
        return JSON.stringify({
            name: this.name,
            description: this.description,
            template: this.template,
            responseSchema: generateSchema(this.responseSchema)
        });
    }

    validateResponse(response: unknown): boolean {
        try {
            this.responseSchema.parse(response);
            return true;
        } catch (error) {
            return false;
        }
    }

    withVars(additionalVars: TemplateVars): MicroAgent {
        return new (this.constructor as any)(
            this.name,
            this.description,
            this.template,
            { ...this.vars, ...additionalVars },
            this.responseSchema
        );
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