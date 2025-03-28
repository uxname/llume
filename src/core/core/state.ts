import pc from "picocolors";

export class State {
  private state: Record<string, string> = {};

  set(key: string, value: string): void {
    this.state[key] = value;
    this.print();
  }

  get(key: string): string | undefined {
    return this.state[key];
  }

  delete(key: string): void {
    delete this.state[key];
    this.print();
  }

  clear(): void {
    this.state = {};
    this.print();
  }

  getState(): Record<string, string> {
    return { ...this.state };
  }

  toString(): string {
    return JSON.stringify(this.state);
  }

  print(): void {
    console.log(
      pc.bgYellowBright(
        `[State changed] Current state: ${JSON.stringify(this.state)}`,
      ),
    );
  }
}
