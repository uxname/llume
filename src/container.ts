import type { AiExecutionEngineBase } from './ai-execution-engine/ai-execution-engine-base.ts'
import {
    AiFunction,
    type MicroAgentResponse,
    type TemplateVars,
} from './ai-function-base/ai-function.ts'
import { Prompt } from './prompt/prompt.ts'
import { zodToJsonSchema } from 'zod-to-json-schema'

export class Container {
    private aiFunctions: Map<string, AiFunction> = new Map()
    private executionEngine: AiExecutionEngineBase
    private rules: Prompt[] = []

    constructor(executionEngine: AiExecutionEngineBase) {
        this.executionEngine = executionEngine
    }

    addRule(rule: string) {
        this.rules.push(new Prompt(rule))
    }

    registerAiFunction(aiFunction: AiFunction) {
        aiFunction.container = this
        this.aiFunctions.set(aiFunction.name, aiFunction)
    }

    // Helper method for retrying with exponential backoff
    private async retry<T>(
        fn: () => Promise<T>,
        maxAttempts = 3,
        baseDelay = 500 // начальное время задержки в мс
    ): Promise<T> {
        let attempt = 0
        while (attempt < maxAttempts) {
            try {
                return await fn()
            } catch (error) {
                attempt++
                if (attempt >= maxAttempts) {
                    throw error
                }
                const delay = baseDelay * Math.pow(2, attempt - 1)
                console.warn(
                    `Attempt ${attempt} failed, retrying in ${delay} ms.`
                )
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }
        throw new Error('Could not execute operation after multiple attempts')
    }

    async executeAiFunction(
        aiFunctionName: string,
        vars: TemplateVars
    ): Promise<MicroAgentResponse> {
        const aiFunction = this.aiFunctions.get(aiFunctionName)
        if (!aiFunction) {
            throw new Error(`AI function "${aiFunctionName}" not found`)
        }

        aiFunction.validateVars(vars)
        const prompt = aiFunction.getPrompt().merge(this.rules)
        const renderedPrompt = prompt.render({
            ...vars,
            schema: JSON.stringify(zodToJsonSchema(aiFunction.responseSchema)),
        })

        return await this.retry(async () => {
            const response = await this.executionEngine.execute({
                prompt: renderedPrompt,
            })

            const parsedResponse = aiFunction.parseResponse(response)
            if (parsedResponse._error) {
                throw new Error(parsedResponse._error?.message)
            }
            return parsedResponse
        })
    }
}
