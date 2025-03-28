import type { Variables } from "./ai-stateless-function.ts";

export class PromptTemplate {
  constructor(public readonly template: string) {}

  public getVariables(): string[] {
    const regex = /{{\s*(\w+)\s*}}/g;
    let matches: RegExpExecArray | null;
    const variables: string[] = [];

    while ((matches = regex.exec(this.template)) !== null) {
      if (matches[1] !== undefined) {
        variables.push(matches[1]);
      }
    }

    return variables;
  }
}

export class PromptRenderer<TVariables extends Variables> {
  constructor(private readonly template: PromptTemplate) {}

  public render(variables: TVariables): string {
    const missingVariables = this.validate(variables);
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required variables: ${missingVariables.join(", ")}`,
      );
    }

    let result = this.template.template;

    for (const varName of this.template.getVariables()) {
      if (!(varName in variables)) {
        throw new Error(`Missing required variable: ${varName}`);
      }

      const value = String(variables[varName]);
      const regex = new RegExp(`{{\\s*${varName}\\s*}}`, "g");
      result = result.replace(regex, value);
    }

    return result;
  }

  public validate(variables: Partial<TVariables>): string[] {
    const missingVariables: string[] = [];

    for (const varName of this.template.getVariables()) {
      if (!(varName in variables)) {
        missingVariables.push(varName);
      }
    }

    return missingVariables;
  }
}
