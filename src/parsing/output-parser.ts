// src/parsing/output-parser.ts

/** Interface for parsing the raw output of an LLM into a typed structure. */
export interface OutputParser<TOutput> {
	/**
	 * Parses the raw string output from the LLM.
	 * @param rawOutput The raw string output from the LLM.
	 * @returns The parsed output of type TOutput. Can be async.
	 * @throws {OutputParsingError} If parsing fails.
	 */
	parse(rawOutput: string): Promise<TOutput> | TOutput;

	/**
	 * Optional: Returns instructions for the LLM on how to format its output.
	 * These instructions are typically added to the prompt.
	 * @returns A string containing format instructions, or null/undefined if not applicable.
	 */
	getFormatInstructions?(): string | null | undefined;
}
