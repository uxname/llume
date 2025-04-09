export interface OutputParser<TOutput> {
	parse(rawOutput: string): Promise<TOutput> | TOutput;
	getFormatInstructions?(): string | null | undefined;
}
