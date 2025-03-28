export class LLM {
  constructor(
    public name: string,
    public execute: (prompt: string) => Promise<string>,
  ) {}
}
