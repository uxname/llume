import { CustomLLMService } from "./customLLMService.ts";
import { MicroAgent } from './micro-agent.ts'; // Assuming MicroAgent is exported from here
import { z } from "zod";

class Calculator extends MicroAgent {
    constructor(evaluation: string) {
        const name = 'Калькулятор';
        const description = 'Калькулятор';
        const template = 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}';
        const variables = { evaluation };
        const responseSchema = z.object({
            result: z.number().describe('Результат выражения'),
            errors: z.array(z.string()).describe('Список ошибок, если есть'),
        });

        super(
            name,
            description,
            template,
            variables,
            responseSchema
        );
    }
}

async function main() {
    const llmService = new CustomLLMService(
        'https://ai0.uxna.me/',
        '123321ai'
    );

    const calculator = new Calculator('2 + 2 * 2');

    const result = await llmService.generateResponse({microAgent: calculator, provider: 'gemini'});
    console.log(result);
}

main();