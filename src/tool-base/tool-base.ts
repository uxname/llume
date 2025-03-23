import { z } from 'zod'

export interface ToolMetadata<
    INPUT extends z.ZodType = z.ZodType,
    OUTPUT extends z.ZodType = z.ZodType,
> {
    name: string
    description: string
    inputSchema: INPUT
    outputSchema: OUTPUT
    examples?: string[]
}

export abstract class ToolBase<
    TInput extends z.infer<z.ZodType>,
    TOutput extends z.infer<z.ZodType>,
> {
    abstract getMetadata(): ToolMetadata

    abstract execute(params: TInput): Promise<TOutput>

    toString(): string {
        return JSON.stringify(this.getMetadata())
    }
}
