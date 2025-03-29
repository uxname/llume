export abstract class LLM {
  public abstract name: string;
  public abstract execute(prompt: string): Promise<string>;
}
