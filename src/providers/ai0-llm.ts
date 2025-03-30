// src/providers/ai0-llm.ts
import axios, { AxiosError } from "axios";
import { LLMProvider } from "../components";
import { LlmError } from "../core";
// Optional: for logging within the provider if needed
// import pc from 'picocolors';

/**
 * Configuration parameters specifically for the AI0 LLM provider request.
 */
export interface Ai0LlmRequestParams {
  prompt: string;
  provider?: string; // e.g., 'gemini', 'openai' - specific backend for AI0 proxy
  randomProvider?: boolean; // AI0 specific flag
}

/**
 * An LLMProvider implementation for interacting with the AI0 proxy service.
 */
export class Ai0Llm extends LLMProvider {
  public readonly name = "AI0"; // Identifier for this provider

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultProvider: string;
  private readonly requestTimeout: number;

  /**
   * Creates an instance of the Ai0Llm provider.
   * @param baseUrl - The base URL of the AI0 proxy service.
   * @param apiKey - The API key for authenticating with the AI0 service.
   * @param defaultProvider - The default backend provider AI0 should use (e.g., 'gemini'). Defaults to 'gemini'.
   * @param requestTimeout - Request timeout in milliseconds. Defaults to 60000 (60 seconds).
   */
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

  /**
   * Executes the prompt against the AI0 LLM proxy.
   *
   * @param prompt - The prompt string to send.
   * @returns A promise resolving to the cleaned text response from the LLM.
   * @throws {LlmError} If the API call fails or returns an error status.
   */
  public async execute(prompt: string): Promise<string> {
    const params: Ai0LlmRequestParams = {
      prompt,
      provider: this.defaultProvider,
      randomProvider: false, // Explicitly set default
    };

    try {
      const response = await axios.post<{
        text: string;
      } /* Expected success response body */>(
        this.baseUrl, // Assuming the baseUrl is the direct endpoint for POST requests
        params,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: this.apiKey, // Assuming API key is passed via Authorization header
          },
          timeout: this.requestTimeout,
        },
      );

      if (response.status === 200 && response.data && response.data.text) {
        // Clean the response: remove markdown code fences for JSON
        return this.cleanResponse(response.data.text);
      } else {
        // Handle non-200 success statuses or unexpected response structure
        throw new LlmError(
          `AI0 request failed with status ${response.status}. Unexpected response structure.`,
          { status: response.status, data: response.data },
        );
      }
    } catch (error) {
      this.logError(error); // Log the original error

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const responseData = axiosError.response?.data;
        throw new LlmError(
          `AI0 request failed: ${status ? `Status ${status}` : error.message}`,
          {
            status: status,
            responseData: responseData,
            requestData: params, // Include request data for debugging
            isAxiosError: true,
          },
        );
      } else {
        // Handle non-Axios errors (e.g., network issues, timeouts before response)
        throw new LlmError(
          `AI0 request failed: ${error instanceof Error ? error.message : String(error)}`,
          error, // Include the original error object
        );
      }
    }
  }

  /**
   * Cleans the raw text response from the LLM.
   * Removes surrounding JSON markdown fences (```json ... ```)
   * and trims whitespace.
   * @param rawResponse - The raw string response from the LLM.
   * @returns The cleaned string.
   */
  private cleanResponse(rawResponse: string): string {
    if (!rawResponse) return "";
    // Remove ```json and ``` from start and end, but not necessarily in the middle.
    // Handles optional space after ```json
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.substring(7).trimStart();
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3).trimEnd();
    }
    // Also handle cases where only ``` is used without 'json'
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3).trimStart();
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3).trimEnd();
    }

    return cleaned.trim(); // Final trim for safety
  }

  /**
   * Logs errors encountered during the API call.
   * @param error - The error object.
   */
  private logError(error: unknown): void {
    // Use a more structured logging approach if available
    console.error(`[${this.name}] Error:`, error);
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(
          `[${this.name}] Response Status:`,
          axiosError.response.status,
        );
        console.error(
          `[${this.name}] Response Data:`,
          axiosError.response.data,
        );
      } else if (axiosError.request) {
        console.error(
          `[${this.name}] No response received. Request details:`,
          axiosError.config,
        );
      }
    }
  }
}
