import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import type { BaseLLMProvider } from "../llm-provider/base-llm-provider.ts";

const weatherResponseSchema = z.object({
    result: z.string().nullable().describe('Человекочитаемое описание погоды'),
    degree: z.number().nullable().describe('Температура в градусах'),
    errors: z.array(z.string()).nullable().describe('Список ошибок, если есть'),
});

export type WeatherResponse = typeof weatherResponseSchema;

export class Weather extends AiFunction<WeatherResponse> {
    constructor(llmProvider?: BaseLLMProvider) {
        super({
            name: 'Погода',
            description: 'Возвращает обычную погоду по заданному городу и дате',
            template: 'Определи какая погода обычно в городе {city} на дату {date}',
            responseSchema: weatherResponseSchema,
            llmProvider
        });
    }
}
