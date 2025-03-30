import fs from "fs";
import * as handlebars from "handlebars";
import * as path from "node:path";

export class PromptHelper {
  static loadTemplate(templatePath: string): string {
    return fs.readFileSync(templatePath, "utf-8");
  }

  static loadSystemPrompt(): string {
    const systemPromptDir = path.join(
      process.cwd(),
      "src",
      "prompt",
      "prompt-templates",
    );
    return PromptHelper.loadTemplate(path.join(systemPromptDir, "prompt.hbs"));
  }

  static compile<T>(template: string, data: T): string {
    const compiledTemplate = handlebars.compile(template);
    return compiledTemplate(data).trim();
  }
}
