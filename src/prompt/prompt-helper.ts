import fs from "fs";
import * as handlebars from "handlebars";
import * as path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PromptHelper {
  static loadTemplate(templatePath: string): string {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    return fs.readFileSync(templatePath, "utf-8");
  }

  static loadSystemPrompt(): string {
    const systemPromptDir = path.join(
      __dirname,
      "..",
      "prompt",
      "prompt-templates",
    );
    const templatePath = path.join(systemPromptDir, "prompt.hbs");

    if (!fs.existsSync(templatePath)) {
      throw new Error(`System prompt template not found: ${templatePath}`);
    }

    return this.loadTemplate(templatePath);
  }

  static compile<T>(template: string, data: T): string {
    const compiledTemplate = handlebars.compile(template);
    return compiledTemplate(data).trim();
  }
}
