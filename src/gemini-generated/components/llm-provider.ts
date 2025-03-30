// src/components/llm-provider.ts

/**
 * Abstract base class for all Large Language Model (LLM) providers.
 * Defines the essential interface for interacting with an LLM.
 */
export abstract class LLMProvider {
  /**
   * A unique name identifying the LLM provider (e.g., "OpenAI-GPT4", "AI0-Gemini").
   */
  public abstract readonly name: string;

  /**
   * Executes a prompt against the LLM and returns the raw text response.
   *
   * @param prompt - The complete prompt string to send to the LLM.
   * @returns A promise that resolves with the LLM's text response.
   * @throws {LlmError} If the LLM provider encounters an error during execution.
   */
  public abstract execute(prompt: string): Promise<string>;

  /**
   * Optional method for any cleanup tasks (e.g., closing connections).
   */
  public async destroy?(): Promise<void>;
}
