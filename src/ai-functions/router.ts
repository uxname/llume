import {AiFunction} from "./ai-function.ts";
import {z} from "zod";
import type {BaseLLMProvider} from "../llm-provider/base-llm-provider.ts";

interface AgentWithAgent {
    agent: string;
    errors?: never;
}

interface AgentWithErrors {
    agent?: never;
    errors: string[];
}

type AgentRouterResponse = AgentWithAgent | AgentWithErrors;

export class AgentRouter extends AiFunction<AgentRouterResponse> {
    constructor(
        llmProvider?: BaseLLMProvider
    ) {
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

    async route(task: string, availableAgents: AiFunction[]) {
        return this.execute({
            task,
            agents: JSON.stringify(availableAgents.map(agent => agent.toString()))
        });
    }
}