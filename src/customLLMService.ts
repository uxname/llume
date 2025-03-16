import axios from "axios";
import { type Prompt, promptToString } from "./prompt-constructor.ts";
import { clearResponse } from "./response-format-constructor.ts";
import { z } from "zod";

export class CustomLLMService {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    async generateResponse<T = any>({ _prompt, provider = 'gemini', randomProvider = false }: {
        _prompt: Prompt,
        provider?: string,
        randomProvider?: boolean,
    }): Promise<T> {
        try {
            const prompt = promptToString(_prompt);
            // Логируем запрос синим цветом
            console.log(`\x1b[34m<< LLM REQUEST >>\n${prompt}\n---------\n\n\x1b[0m`);
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

            // Проверяем формат ответа и выбрасываем ошибку, если он невалиден
            _prompt.responseSchema.parse(result);

            // Логируем ответ зелёным цветом
            console.log(`\x1b[32m<< LLM RESPONSE >>\n${responseRaw}\n---------\n\n\x1b[0m`);
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
