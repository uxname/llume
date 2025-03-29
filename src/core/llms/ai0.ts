import axios from "axios";
import { LLM } from "../core/llm.ts";

import pc from "picocolors";

export interface Ai0RequestParams {
  prompt: string;
  provider?: string;
  randomProvider?: boolean;
}

export class Ai0 extends LLM {
  public readonly name = "AI0";

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    super();
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async generateResponse(params: Ai0RequestParams): Promise<string> {
    const { prompt, provider = "gemini", randomProvider = false } = params;

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
            "Content-Type": "application/json",
            Authorization: this.apiKey,
          },
          timeout: 60000,
        },
      );

      return response.data.text;
    } catch (error) {
      this.logError(error);
      throw error;
    }
  }

  public async execute(prompt: string): Promise<string> {
    const params: Ai0RequestParams = { prompt };
    const response = await this.generateResponse(params);

    // console.log(pc.blue(prompt));
    // console.log(pc.bgYellowBright(response));

    // remove ```json and ``` from start and end of response only, but not in the middle
    return response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  }

  private logError(error: unknown): void {
    console.error(`[${this.name}] Error:`, error);
  }
}
