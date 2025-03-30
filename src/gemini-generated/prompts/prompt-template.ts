// src/prompt/prompt-template.ts
// Reusing the existing, well-functioning PromptTemplate class.

// Define a type for variables used in templates for clarity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateVariables = Record<string, any>;

export class PromptTemplate {
  constructor(public readonly template: string) {}

  /**
   * Extracts all variable names enclosed in double curly braces (e.g., {{variable}})
   * from the template string.
   * @returns An array of unique variable names found in the template.
   */
  public getVariables(): string[] {
    const regex = /{{\s*(\w+)\s*}}/g;
    let match: RegExpExecArray | null;
    const variables = new Set<string>(); // Use Set for automatic uniqueness

    while ((match = regex.exec(this.template)) !== null) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }

    return Array.from(variables);
  }

  /**
   * Renders the template by replacing placeholders with their corresponding values
   * from the provided variables object.
   * Throws an error if any required variables defined in the template are missing
   * in the input object.
   *
   * @param variables - An object containing key-value pairs for template variables.
   * @returns The rendered string with placeholders replaced by values.
   * @throws {Error} If any required variable is missing.
   */
  public render<T extends TemplateVariables>(variables: T): string {
    const requiredVars = this.getVariables();
    const missingVariables = requiredVars.filter(
      (varName) => !(varName in variables),
    );

    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required variables for template: ${missingVariables.join(", ")}`,
      );
    }

    let result = this.template;
    for (const varName of requiredVars) {
      // Ensure value is converted to string for replacement
      const value = String(variables[varName] ?? ""); // Use empty string for null/undefined? Or let String handle it.
      // Use RegExp for global replacement of each variable
      const regex = new RegExp(`{{\\s*${varName}\\s*}}`, "g");
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Validates if the provided variables object contains all variables required by the template.
   * @param variables - A partial object containing variables to check.
   * @returns An array of variable names that are required by the template but missing in the input.
   */
  public validate(variables: Partial<TemplateVariables>): string[] {
    const requiredVars = this.getVariables();
    return requiredVars.filter((varName) => !(varName in variables));
  }
}
