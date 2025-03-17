import { CustomLLMService } from "./customLLMService.ts";
import { MicroAgent } from './micro-agent.ts';
import { z } from "zod";

// Define response type for better type safety
interface CalculatorResponse {
    result: number;
    errors: string[];
}

class Calculator extends MicroAgent<CalculatorResponse> {
    constructor(evaluation: string) {
        super(
            'Калькулятор',
            'Вычисляет математические выражения',
            'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            { evaluation },
            z.object({
                result: z.number().describe('Результат выражения'),
                errors: z.array(z.string()).describe('Список ошибок, если есть'),
            })
        );
    }

    // Convenience method specific to Calculator
    static evaluate(expression: string) {
        return Calculator.create(expression);
    }
}

async function main() {
    const llmService = new CustomLLMService(
        'https://ai0.uxna.me/',
        '123321ai'
    );

    // Method 1: Traditional instantiation
    const calculator = new Calculator('2 + 2 * 2');

    // Method 2: Using static factory method
    const calculator2 = Calculator.create('3 + 3 * 3');

    // Method 3: Using convenience method
    const calculator3 = Calculator.evaluate('4 + 4 * 4');

    // Method 4: Chaining with variable updates
    const baseCalculator = new Calculator('x + y');
    const customCalculator = baseCalculator.withVars({ x: '5', y: '10' });

    // Using the built-in execute method
    const result = await calculator.execute(llmService, 'gemini');
    console.log(result.result); // Typed as number
    console.log(result.errors); // Typed as string[]

    // Or the traditional way
    const response = await llmService.generateResponse({microAgent: calculator, provider: 'gemini'});
    const parsedResult = calculator.parseResponse(response);
    console.log(parsedResult);
}

main();