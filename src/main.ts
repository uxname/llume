import {CustomLLMService} from "./customLLMService.ts";
import {createPrompt} from "./prompt-constructor.ts";
import {z} from "zod";

async function main() {
    const llmService = new CustomLLMService(
        'https://ai0.uxna.me/',
        '123321ai'
    );

    const template = '{a} + {b} = ?';

    const responseSchema = z.object({
        result: z.number().describe("Результат выполнения задачи"),
    });

    const prompt = createPrompt(
        template,
        {
            a: '1',
            b: '2'
        },
        responseSchema
    )

    const result = await llmService.generateResponse({_prompt: prompt});

    console.log('Result:', result);
}

main();