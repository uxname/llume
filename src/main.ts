import { CustomLLMService } from "./customLLMService.ts";
import { MicroAgent, type MicroAgentConfig } from './micro-agent.ts';
import { z } from "zod";

interface CalculatorResponse {
    value: number;
    errors: string[];
}

class Calculator extends MicroAgent<CalculatorResponse> {
    constructor(evaluation: string) {
        const config: MicroAgentConfig<CalculatorResponse> = {
            name: 'Калькулятор',
            description: 'Вычисляет математические выражения',
            template: 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            vars: { evaluation },
            responseSchema: z.object({
                value: z.number().describe('Результат выражения'),
                errors: z.array(z.string()).describe('Список ошибок, если есть'),
            })
        };

        super(config);
    }

    static evaluate(expression: string) {
        return new Calculator(expression);
    }
}

async function main() {
    const llmService = new CustomLLMService(
        'https://ai0.uxna.me/',
        '123321ai'
    );

    const calculator = new Calculator('2 + 2 * 2');
    const result = await calculator.execute(llmService, 'gemini');

    console.log(result.value);
}

main();