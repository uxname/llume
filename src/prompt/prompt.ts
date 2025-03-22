export class Prompt {
    private readonly template: string;

    constructor(template: string) {
        this.template = template;
    }

    render(params: Record<string, any>): string {
        return this.template.replace(/\{([^{}]+)}/g, (match, keyPath) => {
            const value = this.getValueFromPath(params, keyPath.trim());
            if (value instanceof Prompt) {
                return value.render(params);
            }
            return value !== undefined ? String(value) : match;
        });
    }

    isFullyRendered(rendered: string): boolean {
        // Проверяем только плейсхолдеры с содержимым: {key}, но не {}
        return !/\{[^{}]+}/.test(rendered);
    }

    private getValueFromPath(obj: any, path: string): any {
        return path.split('.').reduce((acc, key) => {
            return acc != null ? acc[key] : undefined;
        }, obj);
    }

    getTemplate(): string {
        return this.template;
    }
}