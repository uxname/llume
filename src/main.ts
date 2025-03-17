import {Ai0Provider} from "./llm-provider/ai0-provider.ts";
import {Calculator} from "./ai-functions/calculator.ts";
import {AgentRouter} from "./ai-functions/router.ts";
import {Weather} from "./ai-functions/weather.ts";
import type {AiFunction} from "./ai-functions/ai-function.ts";

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

main();