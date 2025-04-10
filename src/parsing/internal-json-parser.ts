import { OutputParsingError } from "../core/errors";

function extractJsonString(rawOutput: string): string {
	const trimmed = rawOutput.trim();

	const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
	if (jsonFenceMatch?.[1]) {
		return jsonFenceMatch[1].trim();
	}

	const firstBrace = trimmed.indexOf("{");
	const firstBracket = trimmed.indexOf("[");
	let startIndex = -1;

	if (firstBrace === -1 && firstBracket === -1) {
		return trimmed;
	}

	if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
		startIndex = firstBrace;
	} else if (firstBracket !== -1) {
		startIndex = firstBracket;
	}

	if (startIndex !== -1) {
		const lastBrace = trimmed.lastIndexOf("}");
		const lastBracket = trimmed.lastIndexOf("]");
		const endIndex = Math.max(lastBrace, lastBracket);

		if (endIndex > startIndex) {
			return trimmed.substring(startIndex, endIndex + 1);
		}
	}

	return trimmed;
}

export function parseJson<TOutput>(rawOutput: string): TOutput {
	const jsonString = extractJsonString(rawOutput);
	if (!jsonString) {
		throw new OutputParsingError(
			"Could not extract potential JSON content from the output.",
			rawOutput,
		);
	}

	try {
		const parsed = JSON.parse(jsonString);
		return parsed as TOutput;
	} catch (error: unknown) {
		const message =
			error instanceof Error
				? error.message
				: "Failed to parse extracted content as JSON";
		throw new OutputParsingError(message, rawOutput, error);
	}
}
