import type { Variables } from "./ai-function.ts";

export class PromptTemplate {
  constructor(public readonly template: string) {}

  /**
   * Extracts all variables from the template using a regex pattern.
   * Variables are enclosed in double curly braces, e.g., {{ variable }}.
   */
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

  /**
   * Renders the template by replacing placeholders with their corresponding values.
   * Throws an error if any required variables are missing.
   */
  public render<T extends Variables>(variables: T): string {
    const missingVariables = this.validate(variables);
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required variables: ${missingVariables.join(", ")}`,
      );
    }

    let result = this.template;

    for (const varName of this.getVariables()) {
      if (!(varName in variables)) {
        throw new Error(`Missing required variable: ${varName}`);
      }

      const value = String(variables[varName]);
      const regex = new RegExp(`{{\\s*${varName}\\s*}}`, "g");
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Validates the provided variables against the template's required variables.
   * Returns a list of missing variables.
   */
  public validate(variables: Partial<Variables>): string[] {
    const missingVariables: string[] = [];

    for (const varName of this.getVariables()) {
      if (!(varName in variables)) {
        missingVariables.push(varName);
      }
    }

    return missingVariables;
  }
}
