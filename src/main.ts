import {Ai0Provider} from "./llm-provider/ai0-provider.ts";
import {Calculator} from "./ai-functions/calculator.ts";
import {AgentRouter} from "./ai-functions/router.ts";
import {Weather} from "./ai-functions/weather.ts";
import type {AiFunction} from "./ai-functions/ai-function.ts";
import {CodeLoader, type CodeLoaderResponse} from "./ai-functions/code-loader.ts";
import {TextFileTool} from "./tools/text-file-tool.ts";
import * as path from "node:path";

const llmProvider = new Ai0Provider(
    'https://ai0.uxna.me/',
    '123321ai'
);

async function main() {
    const queries = [
        'Какая погода в Минске обычно летом?',
        'сколько будет 9 в квадрате?'
    ];

    // Create agents with LLM service in constructor
    const calculator = new Calculator(llmProvider);
    const agentRouter = new AgentRouter(llmProvider);
    const weather = new Weather(llmProvider);

    function getAiFunctionByName(name: string): AiFunction {
        if (name === 'Калькулятор') return calculator;
        if (name === 'Погода') return weather;
        throw new Error('Unknown AI function name');
    }

    // Execute with variables as parameters
    for (const query of queries) {
        const aiFunctionName = await agentRouter.route(query, [calculator, weather]);
        console.log(`На запрос "${query}" подходит функция "${aiFunctionName.agent}"`);

        const aiFunction = getAiFunctionByName(aiFunctionName.agent!);
        if (aiFunctionName.agent === 'Калькулятор') {
            const response = await aiFunction.execute({evaluation: query});
            console.log('Response:', response);
        } else if (aiFunctionName.agent! === 'Погода') {
            const response = await aiFunction.execute({city: 'Minsk', date: '1 января 2023'});
            console.log('Response:', response);
        }

    }

}

const codeLoader = new CodeLoader(llmProvider);

async function detectCodeReferences(filePath: string, importReferences: string): Promise<CodeLoaderResponse> {
    const fileContent = await TextFileTool.load(filePath);

    return await codeLoader.execute({
        code: fileContent,
        filePath,
        importReferences
    });
}

async function listAllReferences(accumulator: string[], filepath: string): Promise<string[]> {
    console.log(`Processing file: ${filepath}`);
    console.log('Accumulator:', accumulator);
    let result  = await detectCodeReferences(filepath, JSON.stringify(accumulator));

    if (result.importReferences.length > 0) {
        accumulator = accumulator.concat(result.importReferences);
        for (const reference of result.importReferences) {
            accumulator = await listAllReferences(accumulator, reference);
        }
    }
    return accumulator;
}

async function main2() {
    const filePath = path.join(import.meta.dirname, '..', 'package.json');
    const allReferences = await listAllReferences([], filePath);
    console.log(allReferences);
}


main2();
// main();