import axios from "axios";
import {type Prompt, promptToString} from "./prompt-constructor.ts";
import {clearResponse} from "./response-format-constructor.ts";
import {z} from "zod";

export class CustomLLMService {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    async generateResponse({_prompt, provider = 'gemini', randomProvider = false}: {
        _prompt: Prompt,
        provider?: string,
        randomProvider?: boolean,
    }) {
        try {
            const prompt = promptToString(_prompt);
            console.error(`<< LLM REQUEST >>\n${prompt}\n---------\n\n`);
            const response = await axios.post(this.baseUrl, {
                prompt: prompt,
                provider: provider,
                randomProvider: randomProvider
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey
                }
            });

            let responseRaw = response.data.text;
            if (responseRaw.startsWith('```json')) {
                responseRaw = clearResponse(responseRaw);
            }

            const result = JSON.parse(responseRaw);

            // verify response format and throw error if not valid
            _prompt.responseSchema.parse(result);

            console.error(`<< LLM RESPONSE >>\n${responseRaw}\n---------\n\n`);
            return result;
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('Response validation error:', error.message);
                throw error;
            }
            console.error('Error in LLM service:', error);
            throw error;
        }
    }
}