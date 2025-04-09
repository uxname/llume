import type { ZodTypeAny, z } from "zod";
import { OutputParsingError } from "../core/errors";

function extractJsonString(rawOutput: string): string {
	const trimmed = rawOutput.trim();

	// Priority 1: ```json ... ```
	const jsonFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i); // Case-insensitive 'json' tag
	if (jsonFenceMatch?.[1]) {
		return jsonFenceMatch[1].trim();
	}

	// Priority 2: Look for the first '{' or '[' and the last '}' or ']'
	// This is less robust but catches JSON embedded in other text.
	const firstBrace = trimmed.indexOf("{");
	const firstBracket = trimmed.indexOf("[");
	let startIndex = -1;

	if (firstBrace === -1 && firstBracket === -1) {
		// No JSON object/array found, maybe it's just a JSON primitive (string, number, boolean)?
		// Let JSON.parse handle this case directly with the trimmed string.
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
			// Extract the substring that looks like JSON
			return trimmed.substring(startIndex, endIndex + 1);
		}
	}

	// If no clear JSON structure is found, return the trimmed string
	// and let JSON.parse attempt to parse it (will likely fail if not valid JSON)
	return trimmed;
}

/**
 * Parses a JSON object from the LLM's raw output.
 * Extracts the JSON string first, then parses it.
 * @internal
 */
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
		// We cast here, assuming the structure is correct.
		// Zod validation will happen *after* this parsing step.
		return parsed as TOutput;
	} catch (error: unknown) {
		// Throw a specific parsing error if JSON.parse fails
		const message =
			error instanceof Error
				? error.message
				: "Failed to parse extracted content as JSON";
		throw new OutputParsingError(message, rawOutput, error);
	}
}

/**
 * Generates format instructions for the LLM to output JSON based on a Zod schema.
 * Provides a basic description of expected keys and types for object schemas.
 * @internal
 */
export function getJsonFormatInstructions<TOutput>(
	schema: z.ZodType<TOutput>,
): string {
	// Base instruction
	let instructions = `RESPONSE FORMATTING INSTRUCTIONS:
You MUST respond ONLY with a valid JSON object that strictly adheres to the specified structure.
Do NOT include any explanatory text, comments, apologies, or markdown formatting (like \`\`\`) before or after the JSON object.
The JSON object MUST be the only content in your response.`;

	// Add schema-specific details if it's an object
	// Use 'safeParse' to avoid errors if the schema is complex or invalid during instruction generation
	const safeSchema = schema.safeParse(undefined); // We don't need a value, just the structure
	if (
		!safeSchema.success &&
		"shape" in schema &&
		typeof schema.shape === "object" &&
		schema.shape !== null
	) {
		// Attempt to access shape even if safeParse failed (might work for basic objects)
		try {
			const shape = schema.shape as Record<string, ZodTypeAny>;
			const keysDescription = Object.entries(shape)
				.map(([key, value]) => {
					// Try to get a meaningful type name
					let typeName = value._def?.typeName || "unknown";
					// Refine common types
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
					// Add description if available
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
			// Silently ignore errors during instruction generation for robustness
			console.warn(
				"Could not generate detailed JSON structure instructions:",
				e,
			);
		}
	} else if (!safeSchema.success && "typeName" in schema._def) {
		// Handle non-object schemas (e.g., z.string(), z.array())
		instructions += `\n\nThe response should be a JSON representation of type: ${schema._def.typeName}`;
	}

	// Advanced Option: Use zod-to-json-schema for more complete schema descriptions
	// try {
	//   const zodToJsonSchema = require("zod-to-json-schema"); // Ensure this is installed
	//   const jsonSchema = zodToJsonSchema(schema, "responseSchema");
	//   instructions += `\n\nJSON Schema:\n\`\`\`json\n${JSON.stringify(jsonSchema, null, 2)}\n\`\`\``;
	// } catch (e) {
	//    console.warn("Optional dependency 'zod-to-json-schema' not found or failed. Using basic instructions.", e);
	// }

	return instructions;
}
