import {CustomLLMService} from "./customLLMService.ts";
import {MicroAgent, type MicroAgentConfig} from './micro-agent.ts';
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

class Calculator extends MicroAgent<CalculatorResponse> {
    constructor(evaluation: string) {
        const config: MicroAgentConfig<CalculatorResponse> = {
            name: 'Калькулятор',
            description: 'Вычисляет математические выражения',
            template: 'Ты точный калькулятор, посчитай и выдай результат следующего выражения: {evaluation}',
            vars: {evaluation},
            responseSchema: z.object({
                value: z.number().describe('Результат выражения'),
                errors: z.array(z.string()).describe('Список ошибок, если есть'),
            })
        };

        super(config);
    }

    static evaluate(expression: string) {
        return new Calculator(expression);
    }
}

class AgentRouter extends MicroAgent<AgentRouterResponse> {
    constructor(
        task: string,
        agents: MicroAgent[]
    ) {
        const config: MicroAgentConfig<AgentRouterResponse> = {
            name: 'Агент-роутер',
            description: 'Определяет лучший агент для выполнения задачи',
            template: 'Твоя задача выбрать наиболее подходящего агента для выполнения задачи. Вот задача: {task}, вот список доступных агентов: {agents}',
            vars: {
                task,
                agents: JSON.stringify(agents.map(agent => agent.toString()))
            },
            responseSchema: z.union([
                z.object({
                    agent: z.string().describe('Имя выбранного агента'),
                    errors: z.undefined(), // Убедитесь, что errors не определено
                }),
                z.object({
                    agent: z.undefined(), // Убедитесь, что agent не определено
                    errors: z.array(z.string()).describe('Список ошибок, если есть, например если подходящего агента нет'),
                }),
            ])
        }

        super(config);
    }
}

async function main() {
    const llmService = new CustomLLMService(
        'https://ai0.uxna.me/',
        '123321ai'
    );

    // const query = 'Какая погода в Минске обычно летом?';
    const query = 'сколько будет 9 в квадрате?';

    const calculator = new Calculator('сколько будет 9 в квадрате?');

    const agentRouter = new AgentRouter(query, [calculator]);

    const calculatorResult = await calculator.execute(llmService, 'gemini');
    const agentRouterResult = await agentRouter.execute(llmService, 'gemini');

    console.log('calculatorResult', calculatorResult.value);
    console.log('agentRouterResult', agentRouterResult.agent);
}

main();