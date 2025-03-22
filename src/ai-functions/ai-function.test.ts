import { describe, expect, test } from "vitest";
import {Prompt} from "../prompt/prompt.ts";
import {AiFunction} from "./ai-function.ts";
import {z} from "zod";
import {AiExecutionEngineBase} from "../ai-execution-engine/ai-execution-engine-base.ts";

describe('AiFunction', () => {
    test('renders basic template with params', () => {
        const prompt = new Prompt('Calculate {value1} + {value2} = ?');
        const schema = z.object({
            value: z.number().nullable().describe('Результат выражения'),
            errors: z.array(z.string()).nullable().describe('Список ошибок, если есть'),
        });

        type CalculatorResponse = typeof schema;

        class TestAiFunction extends AiFunction<CalculatorResponse> {
            constructor(aiExecutionEngine?: AiExecutionEngineBase) {
                super({
                    name: 'Калькулятор',
                    description: 'Вычисляет математические выражения',
                    prompt: new Prompt('Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}'),
                    responseSchema: schema,
                    aiExecutionEngine
                });
            }
        }

        const aiFunction = new TestAiFunction();
        const renderedPrompt = aiFunction.render({evaluation: '2 + 2'});
        console.log(renderedPrompt);
    });
});