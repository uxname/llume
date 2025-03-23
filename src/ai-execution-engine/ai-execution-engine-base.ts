import { LlmProviderBase, type LLMRequestParams } from './llm-provider-base.ts'

export abstract class AiExecutionEngineBase extends LlmProviderBase {
    public async execute(params: LLMRequestParams): Promise<string> {
        const response = await super.query(params)

        return this.normalizeResponse(response)
    }

    private normalizeResponse(response: string): string {
        // Remove starting code block markers like ```json, ```typescript, etc.
        const startCleanedResponse = response.replace(/^```[\w]*\n/, '')

        // Remove ending code block markers
        const fullyCleanedResponse = startCleanedResponse.replace(/```$/, '')

        // Trim any extra whitespace before and after the content
        return fullyCleanedResponse.trim()
    }
}
