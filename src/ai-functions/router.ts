import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import type { BaseLLMProvider } from "../llm-provider/base-llm-provider.ts";

const agentRouterResponseSchema = z.union([
    z.object({
        agent: z.string().describe('Имя выбранного агента'),
        errors: z.undefined(),
    }),
    z.object({
        agent: z.undefined(),
        errors: z.array(z.string()).describe('Список ошибок, если есть, например если подходящего агента нет'),
    }),
]);

export type AgentRouterResponse = typeof agentRouterResponseSchema;

export class AgentRouter extends AiFunction<AgentRouterResponse> {
    constructor(llmProvider?: BaseLLMProvider) {
        super({
            name: 'Агент-роутер',
            description: 'Определяет лучший агент для выполнения задачи',
            template: 'Твоя задача выбрать наиболее подходящего агента для выполнения задачи. Вот задача: {task}, вот список доступных агентов: {agents}',
            responseSchema: agentRouterResponseSchema,
            llmProvider
        });
    }

    async route(task: string, availableAgents: AiFunction[]) {
        return this.execute({
            task,
            agents: JSON.stringify(availableAgents.map(agent => agent.toInfo()))
        });
    }
}
