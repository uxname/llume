import { z } from 'zod'
import { Prompt } from '../../prompt/prompt.ts'
import { AiFunction } from '../../ai-function-base/ai-function.ts'

const schema = z.object({
    value: z.number().nullable().describe('Expression result'),
})

export type CalculatorResponse = typeof schema

export class Calculator extends AiFunction<CalculatorResponse> {
    constructor() {
        super({
            name: 'Calculator',
            description: 'Calculates mathematical expressions',
            prompt: new Prompt(
                'You are a true calculator, calculate and return the result of the following expression: {evaluation}'
            ),
            responseSchema: schema,
        })
    }
}
