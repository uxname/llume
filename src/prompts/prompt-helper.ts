import fs from "fs/promises";
import * as handlebars from "handlebars";

export class PromptHelper {
  static async loadTemplate(templatePath: string): Promise<string> {
    return await fs.readFile(templatePath, "utf-8");
  }

  static compile<T>(template: string, data: T): string {
    const compiledTemplate = handlebars.compile(template);
    return compiledTemplate(data).trim();
  }
}
