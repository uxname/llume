import {generateSchema, type ResponseSchema} from "./response-format-constructor.ts";
import {z} from "zod";

type TemplateVars = { [key: string]: string };

export type Prompt = {
    template: string,
    vars: TemplateVars,
    responseSchema: z.ZodType
}

export function createPrompt(template: string, vars: TemplateVars, responseSchema: z.ZodType): Prompt {
    return {
        template,
        vars,
        responseSchema
    };
}

export function addVariablesToTemplate(prompt: string, vars: TemplateVars): string {
    return prompt.replace(/\{(\w+)}/g, (match, key) => {
        if (key in vars) {
            return vars[key];
        }
        console.warn(`Key "${key}" not found in vars.`);
        return match; // Return the original match if key is not found
    });
}

export function promptToString(prompt: Prompt): string {
    const responseSchema = JSON.stringify(generateSchema(prompt.responseSchema));

    const promptTemplate = `${prompt.template}
Answer format json should according to the following JSON schema: {schema}
Do not send any other data. Do not send markdown.`;

    return addVariablesToTemplate(promptTemplate, {
        ...prompt.vars,
        schema: responseSchema
    });
}