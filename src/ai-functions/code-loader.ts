import {AiFunction} from "./ai-function.ts";
import {z} from "zod";
import type {BaseLLMProvider} from "../llm-provider/base-llm-provider.ts";

const schema = z.object({
    importReferences: z.array(z.string().describe('Полный путь к импортируемому файлу (включая текущую папку)')),
    currentDir: z.string().describe('Путь к папке с файлом'),
})

export type CodeLoaderResponse = typeof schema;

export class CodeLoader extends AiFunction<CodeLoaderResponse> {
    constructor(
        llmProvider?: BaseLLMProvider
    ) {
        super({
            name: 'Загрузчик кода',
            description: 'Загружает код из файла и определяет какие ещё файлы нужно импортировать',
            template: `Вот файл с кодом: {code}. Вот путь к этому файлу: {filePath}.
            Проанализируй его и определи какие ещё файлы нужно импортировать.
            Пути к файлам должны быть полными, например если файл находится в папке "/src", а файл называется "index.ts", то путь будет "/src/index.ts". 
            Игнорируй файлы, которые не нужно импортировать, например из node_modules или системные импорты типа "node:*
            Также игнорируй файлы из библиотек.
            Не возвращай те файл которые уже были найдены: {importReferences}`,
            responseSchema: schema,
            llmProvider
        });
    }
}