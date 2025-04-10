import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { OutputParsingError } from "../core/errors";

function extractJsonString(rawOutput: string): string {
	const trimmed = rawOutput.trim();
	const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
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

export function getJsonFormatInstructions<TOutput>(
	schema: z.ZodType<TOutput>,
): string {
	const baseInstructions = `RESPONSE FORMATTING INSTRUCTIONS:
You MUST respond ONLY with a valid JSON object that strictly adheres to the JSON Schema provided below.
Do NOT include any explanatory text, comments, apologies, or markdown formatting (like \`\`\`) before or after the JSON object.
The JSON object MUST be the only content in your response.`;

	try {
		const jsonSchema = zodToJsonSchema(schema, {
			target: "jsonSchema7", // Specify target version if needed, defaults may vary
			$refStrategy: "none", // Avoid external refs for simpler inline schema
		});

		// Remove unnecessary top-level fields that might confuse the LLM
		jsonSchema.$schema = undefined;
		jsonSchema.default = undefined;
		jsonSchema.definitions = undefined; // If $refStrategy is 'none', this shouldn't exist anyway

		const schemaString = JSON.stringify(jsonSchema, null, 2);

		return `${baseInstructions}\n\nJSON SCHEMA:\n\`\`\`json\n${schemaString}\n\`\`\``;
	} catch (error: unknown) {
		console.warn(
			"Could not generate JSON schema from Zod schema. Falling back to basic instructions.",
			error,
		);
		// Fallback to basic instructions if schema generation fails
		return `${baseInstructions}\n\nPlease ensure your response is a valid JSON object.`;
	}
}
