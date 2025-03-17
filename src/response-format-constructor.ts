import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

export type ResponseSchema = object;

export function generateSchema<T>(schema: z.ZodType<T>): ResponseSchema {
    return zodToJsonSchema(schema);
}
