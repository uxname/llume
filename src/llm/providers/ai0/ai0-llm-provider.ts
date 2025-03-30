import axios, { AxiosError } from "axios";
import { BaseLlmProvider } from "../../base-llm-provider/base-llm-provider.ts";

export interface Ai0LlmRequestParams {
  prompt: string;
  provider?: string;
  randomProvider?: boolean;
}

export class Ai0LlmProvider extends BaseLlmProvider {
  public readonly name = "AI0";

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultProvider: string;
  private readonly requestTimeout: number;

  constructor(
    baseUrl: string,
    apiKey: string,
    defaultProvider: string = "gemini",
    requestTimeout: number = 60000,
  ) {
    super();
    if (!baseUrl || !apiKey) {
      throw new Error("[Ai0Llm] Base URL and API Key are required.");
    }
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.defaultProvider = defaultProvider;
    this.requestTimeout = requestTimeout;
  }

  protected async executeRaw(prompt: string): Promise<string> {
    const params: Ai0LlmRequestParams = {
      prompt,
      provider: this.defaultProvider,
      randomProvider: false,
    };

    try {
      const response = await axios.post<{ text: string }>(
        this.baseUrl,
        params,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: this.apiKey,
          },
          timeout: this.requestTimeout,
        },
      );

      if (response.status === 200 && response.data && response.data.text) {
        return response.data.text;
      }
      throw new Error(`[Ai0Llm] Unexpected response: ${response.data}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const responseData = axiosError.response?.data;
        throw new Error(
          `[Ai0Llm] API call failed with status ${status}: ${responseData}`,
        );
      }
      throw new Error(`[Ai0Llm] API call failed: ${error}`);
    }
  }
}
