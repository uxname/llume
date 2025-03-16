import {CustomLLMService} from "./customLLMService.ts";
import {createPrompt} from "./prompt-constructor.ts";
import {z} from "zod";
import * as fs from "node:fs";

function loadTextFile(path: string): string {
    const content = fs.readFileSync(path, 'utf-8');
    // add string numbers
    return content.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
}

function saveTextFile(path: string, content: string): void {
    fs.writeFileSync(path, content);
}

const currentFile = import.meta.filename;
const currentFileContent = loadTextFile(currentFile);

async function main() {
    const llmService = new CustomLLMService(
        'https://ai0.uxna.me/',
        '123321ai'
    );

    const template = 'Твоя задача проанализировать код и определить потенциальные проблемы и уязвимости. Также нужно предложить решения. Вот код:\n{code}';
    const variables = {
        code: currentFileContent
    }

    const responseSchema = z.object({
        potentialProblems: z.array(
            z.object({
                problem: z.string().describe("Потенциальная проблема"),
                criticalLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe("Уровень критичности проблемы"),
                stringStart: z.number().describe("Номер строки, с которой начинается проблема"),
                stringEnd: z.number().describe("Номер строки, на которой заканчивается проблема"),
                solution: z.string().describe("Решение")
            })
        ).describe("Массив потенциальных проблем и решений"),
        potentialProblemCount: z.number().describe("Количество потенциальных проблем"),
        // not empty string
        refactoredCode: z.string().nonempty().describe("Код в котором исправлены все проблемы")
    });

    const prompt = createPrompt(
        template,
        variables,
        responseSchema
    )

    const result = await llmService.generateResponse({_prompt: prompt, provider: 'gemini'});

    // saveTextFile(`${import.meta.filename}.refactored.ts`, result.refactoredCode);
}

main();