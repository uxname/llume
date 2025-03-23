import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Prompt } from '../prompt/prompt.ts'
import type { Container } from '../container.ts'

export type TemplateVars = { [key: string]: string }

const AiErrorSchema = z.object({
    _error: z
        .object({
            message: z.string().describe('Error message'),
        })
        .optional(),
})

type AiError = z.infer<typeof AiErrorSchema>

export type MicroAgentResponse<T = unknown> = T &
    AiError & {
        _raw: string
    }

interface ConstructorParams<TSchema extends z.ZodType = z.ZodType> {
    description: string
    name: string
    prompt: Prompt
    responseSchema: TSchema
}

export abstract class AiFunction<TSchema extends z.ZodType = z.ZodType> {
    public readonly name: string
    public readonly description: string
    public readonly prompt: Prompt
    public readonly responseSchema: z.ZodType
    public container: Container | undefined

    protected constructor(data: ConstructorParams<TSchema>) {
        this.name = data.name
        this.description = data.description
        this.prompt = data.prompt
        this.responseSchema = data.responseSchema.and(AiErrorSchema)
    }

    private getSystemPrompt(): Prompt {
        return new Prompt(`Answer format json should according to the following JSON schema:
{schema}
Fill the field "error" only if you can't answer the question.
Do not send unknown other data. Do not send markdown.`)
    }

    getPrompt(): Prompt {
        return this.prompt.merge(this.getSystemPrompt())
    }

    toJson(): {
        name: string
        description: string
        prompt: string
        responseSchema: unknown
    } {
        return {
            name: this.name,
            description: this.description,
            prompt: this.prompt.getTemplate(),
            responseSchema: zodToJsonSchema(this.responseSchema),
        }
    }

    toString(): string {
        return JSON.stringify(this.toJson())
    }

    parseResponse(response: string): MicroAgentResponse<z.infer<TSchema>> {
        try {
            const parsedResponse = JSON.parse(response)
            const parsed = this.responseSchema.parse(parsedResponse)
            return { ...parsed, _raw: response }
        } catch (error) {
            throw new Error(
                `Invalid response format: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    public async execute(
        vars: TemplateVars
    ): Promise<MicroAgentResponse<z.infer<TSchema>>> {
        if (!this.container) {
            throw new Error('AiFunction is not attached to a container')
        }
        return this.container.executeAiFunction(this.name, vars)
    }

    public validateVars(vars: TemplateVars): void {
        const renderedPrompt = this.getPrompt().render({
            ...vars,
            schema: JSON.stringify(zodToJsonSchema(this.responseSchema)),
        })
        const isFullyRendered = this.prompt.isFullyRendered(renderedPrompt)
        if (!isFullyRendered) {
            const missingVariables = this.extractVariableNames(renderedPrompt)
            throw new Error(`Missing variables: ${missingVariables.join(', ')}`)
        }
    }

    private extractVariableNames(template: string): string[] {
        const matches = template.match(/\{(\w+)}/g) || []
        return matches
            .map((match) => match.substring(1, match.length - 1))
            .filter((key) => key !== 'schema') // Исключаем переменную "schema", которая добавляется автоматически
    }
}
