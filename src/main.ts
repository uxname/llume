import {Ai0Provider} from "./llm-provider/ai0-provider.ts";
import {MicroAgent} from './micro-agent.ts';
import {z} from "zod";

interface CalculatorResponse {
    value: number;
    errors: string[];
}

interface AgentWithAgent {
    agent: string;
    errors?: never;
}

interface AgentWithErrors {
    agent?: never;
    errors: string[];
}

type AgentRouterResponse = AgentWithAgent | AgentWithErrors;

const llmProvider = new Ai0Provider(
    'https://ai0.uxna.me/',
    '123321ai'
);

class Calculator extends MicroAgent<CalculatorResponse> {
    constructor() {
        super({
            name: 'Калькулятор',
            description: 'Вычисляет математические выражения',
            template: 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            responseSchema: z.object({
                value: z.number().describe('Результат выражения'),
                errors: z.array(z.string()).describe('Список ошибок, если есть'),
            }),
            llmProvider
        });
    }
}

class AgentRouter extends MicroAgent<AgentRouterResponse> {
    constructor() {
        super({
            name: 'Агент-роутер',
            description: 'Определяет лучший агент для выполнения задачи',
            template: 'Твоя задача выбрать наиболее подходящего агента для выполнения задачи. Вот задача: {task}, вот список доступных агентов: {agents}',
            responseSchema: z.union([
                z.object({
                    agent: z.string().describe('Имя выбранного агента'),
                    errors: z.undefined(), // Убедитесь, что errors не определено
                }),
                z.object({
                    agent: z.undefined(), // Убедитесь, что agent не определено
                    errors: z.array(z.string()).describe('Список ошибок, если есть, например если подходящего агента нет'),
                }),
            ]),
            llmProvider
        });
    }

    async route(task: string, availableAgents: MicroAgent[]) {
        return this.execute({
            task,
            agents: JSON.stringify(availableAgents.map(agent => agent.toString()))
        });
    }
}

async function main() {
    const geminiOptions = {provider: 'gemini'};

    // const query = 'Какая погода в Минске обычно летом?';
    const query = 'сколько будет 9 в квадрате?';

    // Create agents with LLM service in constructor
    const calculator = new Calculator();
    const agentRouter = new AgentRouter();

    // Execute with variables as parameters
    const calculatorResult = await calculator.execute({evaluation: query});
    const agentRouterResult = await agentRouter.route(query, [calculator]);

    console.log('calculatorResult', calculatorResult.value);
    console.log('agentRouterResult', agentRouterResult.agent);
}

main();