export class Prompt {
    private readonly template: string

    constructor(template: string) {
        this.template = template
    }

    render(params: Record<string, unknown>): string {
        return this.template.replace(/\{([^{}]+)}/g, (match, keyPath) => {
            const trimmedPath = keyPath.trim()
            const value = this.getValueFromPath(params, trimmedPath)
            if (value instanceof Prompt) {
                return value.render(params)
            }
            return value !== undefined && value !== null ? String(value) : match
        })
    }

    isFullyRendered(rendered: string): boolean {
        const placeholders = new Set<string>()
        this.template.replace(/\{([^{}]+)}/g, (match) => {
            placeholders.add(match)
            return match
        })
        return ![...placeholders].some((ph) => rendered.includes(ph))
    }

    private getValueFromPath(
        obj: Record<string, unknown>,
        path: string
    ): unknown {
        try {
            return path.split('.').reduce<unknown>((acc, key) => {
                if (acc == null || typeof acc !== 'object') return undefined
                return (acc as Record<string, unknown>)[key]
            }, obj)
        } catch {
            return undefined
        }
    }

    getTemplate(): string {
        return this.template
    }

    merge(other: Prompt, separator?: string): Prompt
    merge(others: Prompt[], separator?: string): Prompt
    merge(otherOrOthers: Prompt | Prompt[], separator: string = '\n'): Prompt {
        if (Array.isArray(otherOrOthers)) {
            const combinedTemplate = [
                this.template,
                ...otherOrOthers.map((p) => p.template),
            ].join(separator)
            return new Prompt(combinedTemplate)
        } else {
            return new Prompt(
                `${this.template}${separator}${otherOrOthers.template}`
            )
        }
    }
}
