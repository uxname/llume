import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

export type ResponseSchema = object;

export function generateSchema<T>(schema: z.ZodType<T>): ResponseSchema {
    return zodToJsonSchema(schema);
}

export function clearResponse(response: string): string {
    // remove ```json
    // remove ```
    return response.replace(/```json/g, '').replace(/```/g, '');
}

export function validateResponse<T>(response: string, schema: z.ZodType<T>): T {
    return schema.parse(JSON.parse(response));
}
