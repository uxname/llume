import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import type { BaseLLMProvider } from "../llm-provider/base-llm-provider.ts";

const schema = z.object({
    value: z.number().nullable().describe('Результат выражения'),
    errors: z.array(z.string()).nullable().describe('Список ошибок, если есть'),
});

export type CalculatorResponse = typeof schema;

export class Calculator extends AiFunction<CalculatorResponse> {
    constructor(llmProvider?: BaseLLMProvider) {
        super({
            name: 'Калькулятор',
            description: 'Вычисляет математические выражения',
            template: 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            responseSchema: schema,
            llmProvider
        });
    }
}
