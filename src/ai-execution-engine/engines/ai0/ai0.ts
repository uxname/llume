import axios from 'axios'
import { type LLMRequestParams } from '../../llm-provider-base.ts'
import { AiExecutionEngineBase } from '../../ai-execution-engine-base.ts'

export interface Ai0RequestParams extends LLMRequestParams {
  provider?: string
  randomProvider?: boolean
}

export class Ai0 extends AiExecutionEngineBase {
  name = 'AI0'

  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    super()
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  protected async generateResponse<T = unknown>(
    params: Ai0RequestParams
  ): Promise<T> {
    const { prompt, provider = 'gemini', randomProvider = false } = params

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          prompt,
          provider,
          randomProvider,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.apiKey,
          },
          timeout: 60000,
        }
      )

      return response.data.text
    } catch (error) {
      this.logError(error)
      throw error
    }
  }
}
