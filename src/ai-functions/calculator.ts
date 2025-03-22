import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import {AiExecutionEngineBase} from "../ai-execution-engine/ai-execution-engine-base.ts";

const schema = z.object({
    value: z.number().nullable().describe('Результат выражения'),
    errors: z.array(z.string()).nullable().describe('Список ошибок, если есть'),
});

export type CalculatorResponse = typeof schema;

export class Calculator extends AiFunction<CalculatorResponse> {
    constructor(aiExecutionEngine?: AiExecutionEngineBase) {
        super({
            name: 'Калькулятор',
            description: 'Вычисляет математические выражения',
            template: 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            responseSchema: schema,
            aiExecutionEngine
        });
    }
}
