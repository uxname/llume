import axios from "axios";
import {BaseLLMProvider, type LLMRequestParams} from "./base-llm-provider.ts";

export interface Ai0RequestParams extends LLMRequestParams {
    provider?: string;
    randomProvider?: boolean;
}

export class Ai0Provider extends BaseLLMProvider {
    name = 'AI0';

    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(baseUrl: string, apiKey: string) {
        super();
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    public async query<T = any>(params: LLMRequestParams): Promise<T> {
        return super.query({
            prompt: params.prompt,
            log: true
        });
    }

    protected async generateResponse<T = any>(params: Ai0RequestParams): Promise<T> {
        const {prompt, provider = 'gemini', randomProvider = false} = params;

        try {
            const response = await axios.post(this.baseUrl, {
                prompt,
                provider,
                randomProvider,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey
                }
            });

            let responseRaw = this.clearResponse(response.data.text)

            return JSON.parse(responseRaw);
        } catch (error) {
            this.logError(error);
            throw error;
        }
    }

    private clearResponse(response: string): string {
        // Remove starting code block markers like ```json, ```typescript, etc.
        const startCleanedResponse = response.replace(/^```[\w]*\n/, '');

        // Remove ending code block markers
        const fullyCleanedResponse = startCleanedResponse.replace(/```$/, '');

        // Trim any extra whitespace before and after the content
        return fullyCleanedResponse.trim();
    }
}