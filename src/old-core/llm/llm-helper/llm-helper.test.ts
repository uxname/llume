import { describe, expect, it } from "vitest";
import { LlmHelper } from "./llm-helper.ts";

describe("LlmHelper", () => {
	describe("sanitizeLLMJsonResponse", () => {
		// JSON Block Extraction Tests
		it("should extract JSON from properly formatted ```json block", () => {
			const input = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe('{"key": "value"}');
		});

		it("should handle JSON block with mixed case marker", () => {
			const input = "```JSON\n[1, 2, 3]\n```";
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe("[1, 2, 3]");
		});

		it("should ignore whitespace around JSON in code block", () => {
			const input = 'Text\n```json\n   {"key": "value"}   \n```\nMore text';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe('{"key": "value"}');
		});

		// Generic Code Block Extraction Tests
		it("should extract JSON from generic code block with valid content", () => {
			const input = 'Text\n```{"valid": true}```';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe('{"valid": true}');
		});

		it("should ignore generic code block with non-JSON content", () => {
			const input = '```text\nNot JSON\n```\n{"actual": "json"}';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{"actual": "json"}',
			);
		});

		it("should handle empty code blocks gracefully", () => {
			const input = "```\n```";
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe("");
		});

		// Brace-boundary Extraction Tests
		it("should extract JSON using first/last braces with proper nesting", () => {
			const input = 'Noise { "nested": { "key": "value" }, "array": [1, 2] }';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "nested": { "key": "value" }, "array": [1, 2] }',
			);
		});

		it("should handle nested JSON structures with arrays", () => {
			const input = '[1, { "a": [2, 3] }, 4] noise';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'[1, { "a": [2, 3] }, 4]',
			);
		});

		it("should handle malformed JSON with proper boundaries", () => {
			const input = '{ "incomplete": "json" } some noise [1, 2]';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "incomplete": "json" }',
			);
		});

		it("should handle unbalanced braces correctly", () => {
			const input = '{ "key": "value" } some text }';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "key": "value" }',
			);
		});

		// Edge Case Tests
		it("should return empty string when no JSON is found", () => {
			expect(LlmHelper.sanitizeLLMJsonResponse("No JSON here")).toBe("");
		});

		it("should handle empty response gracefully", () => {
			expect(LlmHelper.sanitizeLLMJsonResponse("")).toBe("");
		});

		it("should handle responses with only opening or closing braces", () => {
			expect(LlmHelper.sanitizeLLMJsonResponse("{")).toBe("");
			expect(LlmHelper.sanitizeLLMJsonResponse("}")).toBe("");
		});

		it("should handle JSON with trailing commas (not valid but should still extract)", () => {
			const input = '{ "array": [1, 2, ], "obj": { "a": 1, }, }';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "array": [1, 2, ], "obj": { "a": 1, }, }',
			);
		});

		// Priority Order Tests
		it("should prioritize JSON block over generic code block", () => {
			const input = '```json\n{"correct": true}\n```\n```[1,2]```';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{"correct": true}',
			);
		});

		it("should prioritize code block over brace-boundary extraction", () => {
			const input = '```[1,2]```\n{ "ignored": true }';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe("[1,2]");
		});

		// Complex Scenarios
		it("should handle deeply nested JSON structures", () => {
			const input = '{ "level1": { "level2": { "level3": [1, 2, 3] } } } extra';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "level1": { "level2": { "level3": [1, 2, 3] } } }',
			);
		});

		it("should handle multiple JSON candidates and extract the first valid one", () => {
			const input = '{ "first": true } some text { "second": false }';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "first": true }',
			);
		});

		it("should handle JSON with escaped characters", () => {
			const input = '{ "key": "value with \\"escaped\\" quotes" }';
			expect(LlmHelper.sanitizeLLMJsonResponse(input)).toBe(
				'{ "key": "value with \\"escaped\\" quotes" }',
			);
		});
	});
});
