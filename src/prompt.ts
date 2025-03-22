export class Prompt {
    private readonly template: string;

    constructor(template: string) {
        this.template = template;
    }

    render(params: Record<string, any>): string {
        // Используем регулярное выражение для поиска всех плейсхолдеров вида {key} или {obj.key}
        return this.template.replace(/\{([^{}]+)}/g, (match, keyPath) => {
            const value = this.getValueFromPath(params, keyPath.trim());
            // Если значение найдено (не undefined), подставляем его, иначе оставляем исходный плейсхолдер
            return value !== undefined ? String(value) : match;
        });
    }

    isFullyRendered(rendered: string): boolean {
        // Проверяем, что в строке больше не осталось шаблонных плейсхолдеров
        return !/\{[^{}]*}/.test(rendered);
    }

    // Вспомогательный метод для обхода объекта по пути с точками, например, "user.name"
    private getValueFromPath(obj: any, path: string): any {
        return path.split('.').reduce((acc, key) => {
            return acc != null ? acc[key] : undefined;
        }, obj);
    }
}
