import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import type { LlmProviderBase } from "../llm-provider/llm-provider-base.ts";

const schema = z.object({
    value: z.number().nullable().describe('Результат выражения'),
    errors: z.array(z.string()).nullable().describe('Список ошибок, если есть'),
});

export type CalculatorResponse = typeof schema;

export class Calculator extends AiFunction<CalculatorResponse> {
    constructor(llmProvider?: LlmProviderBase) {
        super({
            name: 'Калькулятор',
            description: 'Вычисляет математические выражения',
            template: 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            responseSchema: schema,
            aiExecutionEngine: llmProvider
        });
    }
}
