import {AiFunction} from "./ai-function.ts";
import {z} from "zod";
import type {BaseLLMProvider} from "../llm-provider/base-llm-provider.ts";

export interface CodeRefactorerResponse {
    refactoredCode: {
        filePath: string;
        content: string;
    }[],
    comments: string[];
}

export class CodeRefactorer extends AiFunction<CodeRefactorerResponse> {
    constructor(
        llmProvider?: BaseLLMProvider
    ) {
        super({
            name: 'Рефакторщик кода',
            description: 'Рефакторит код, чтобы он стал чище, проще и безопаснее',
            template: `Проанализируй этот код, затем отрефактори его так, чтобы он стал
            чище, проще и безопаснее:\n{code}`,
            responseSchema: z.object({
                refactoredCode: z.array(z.object({
                    filePath: z.string().describe('Путь к файлу'),
                    content: z.string().describe('Отрефакторенный код'),
                })),
                comments: z.array(z.string().describe('Краткий комментарий что было изменено')),
            }),
            llmProvider
        });
    }
}