export class Prompt {
  private readonly template: string;

  constructor(template: string) {
    this.template = template;
  }

  render(params: Record<string, unknown>): string {
    return this.template.replace(/\{([^{}]+)}/g, (match, keyPath) => {
      const trimmedPath = keyPath.trim();
      const value = this.getValueFromPath(params, trimmedPath);
      if (value instanceof Prompt) {
        return value.render(params);
      }
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  isFullyRendered(rendered: string): boolean {
    // Извлекаем все плейсхолдеры из исходного шаблона
    const placeholders = new Set<string>();
    this.template.replace(/\{([^{}]+)}/g, (match) => {
      placeholders.add(match);
      return match;
    });

    // Проверяем, остались ли эти плейсхолдеры в отрендеренной строке
    return ![...placeholders].some((ph) => rendered.includes(ph));
  }

  private getValueFromPath(obj: unknown, path: string): unknown {
    try {
      return path.split(".").reduce((acc, key) => {
        if (acc == null) return undefined;
        return acc[key];
      }, obj);
    } catch {
      return undefined;
    }
  }

  getTemplate(): string {
    return this.template;
  }
}
