/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ToolCallResult {
	toolName: string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	toolInput: any;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	toolOutput: any;
}
