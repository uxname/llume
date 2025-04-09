import type { ZodTypeAny, z } from "zod";
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
	let instructions = `RESPONSE FORMATTING INSTRUCTIONS:
You MUST respond ONLY with a valid JSON object that strictly adheres to the specified structure.
Do NOT include any explanatory text, comments, apologies, or markdown formatting (like \`\`\`) before or after the JSON object.
The JSON object MUST be the only content in your response.`;

	const safeSchema = schema.safeParse(undefined);
	if (
		!safeSchema.success &&
		"shape" in schema &&
		typeof schema.shape === "object" &&
		schema.shape !== null
	) {
		try {
			const shape = schema.shape as Record<string, ZodTypeAny>;
			const keysDescription = Object.entries(shape)
				.map(([key, value]) => {
					let typeName = value._def?.typeName || "unknown";
					if (
						typeName === "ZodString" &&
						value._def.checks?.some((c: { kind: string }) => c.kind === "enum")
					) {
						typeName = `enum: [${(value._def.values as string[]).map((v) => `"${v}"`).join(", ")}]`;
					} else if (typeName === "ZodString") typeName = "string";
					else if (typeName === "ZodNumber") typeName = "number";
					else if (typeName === "ZodBoolean") typeName = "boolean";
					else if (typeName === "ZodArray") typeName = "array";
					else if (typeName === "ZodObject") typeName = "object";

					const description = value.description
						? ` (${value.description})`
						: "";
					return `  "${key}": <${typeName}>${description}`;
				})
				.join(",\n");

			if (keysDescription) {
				instructions += `\n\nREQUIRED JSON STRUCTURE:\n{\n${keysDescription}\n}`;
			}
		} catch (e) {
			console.warn(
				"Could not generate detailed JSON structure instructions:",
				e,
			);
		}
	} else if (!safeSchema.success && "typeName" in schema._def) {
		instructions += `\n\nThe response should be a JSON representation of type: ${schema._def.typeName}`;
	}

	return instructions;
}
