import {Ai0Provider} from "./llm-provider/ai0-provider.ts";
import {Calculator} from "./agents/calculator.ts";
import {AgentRouter} from "./agents/router.ts";

const llmProvider = new Ai0Provider(
    'https://ai0.uxna.me/',
    '123321ai'
);

async function main() {
    const query1 = 'Какая погода в Минске обычно летом?';
    const query2 = 'сколько будет 9 в квадрате?';

    // Create agents with LLM service in constructor
    const calculator = new Calculator(llmProvider);
    const agentRouter = new AgentRouter(llmProvider);

    // Execute with variables as parameters
    const calculatorResult1 = await calculator.execute({evaluation: query1});
    const calculatorResult2 = await calculator.execute({evaluation: query2});
    const agentRouterResult1 = await agentRouter.route(query1, [calculator]);
    const agentRouterResult2 = await agentRouter.route(query2, [calculator]);

    console.log('calculatorResult1', calculatorResult1.value);
    console.log('calculatorResult2', calculatorResult2.value);
    console.log('agentRouterResult', agentRouterResult1.agent);
    console.log('agentRouterResult', agentRouterResult2.agent);
}

main();