// src/prompts/prompt-builder.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AgentContext } from "../core";
import type { AiFunctionDefinition } from "../components";
import {
  BaseSuccessSchema,
  CallToolSchema,
  ErrorSchema,
  // Import FunctionVariables and LlmResponse as types
  type FunctionVariables,
  type LlmResponse,
  LlmResponseSchema, // Import the Zod schema for validation
} from "../schemas"; // Assuming common schemas are here
import { EXECUTE_FUNCTION_TEMPLATE } from "./templates/execute-function.template";

/**
 * Variables expected by the EXECUTE_FUNCTION_TEMPLATE.
 */
type ExecuteFunctionPromptVars = {
  tools: string;
  history: string;
  state: string;
  responseSchema: string;
  userQuery: string;
};

export class PromptBuilder {
  /**
   * Generates the JSON schema for the expected LLM response structure,
   * combining the generic Success, Error, and CallTool schemas with the
   * specific output schema of the target AI function.
   *
   * @param aiFunction - The definition of the AI function being executed.
   * @returns A stringified JSON schema for the LLM response.
   */
  public static buildResponseSchema(
    // Use z.ZodTypeAny for schema generics
    aiFunction: AiFunctionDefinition<z.ZodTypeAny, z.ZodTypeAny>,
  ): string {
    // Create a specific Success schema variant incorporating the function's output schema
    const SuccessSchemaForFunction = BaseSuccessSchema.extend({
      _data: aiFunction.outputSchema, // Embed the function's specific output schema
    });

    // Combine the specific success schema with the generic error and tool call schemas
    // Using discriminatedUnion for clear structure based on _type
    const systemSchemas = z.discriminatedUnion("_type", [
      SuccessSchemaForFunction,
      ErrorSchema,
      CallToolSchema,
    ]);

    // Convert the combined Zod schema to a JSON schema string
    try {
      const jsonSchema = zodToJsonSchema(systemSchemas, {
        $refStrategy: "none", // Avoid $refs for simpler LLM consumption
        definitionPath: "schemas", // Optional: Namespace definitions
        errorMessages: true, // Include descriptions from Zod .describe()
      });
      return JSON.stringify(jsonSchema, null, 2); // Pretty-print for readability in logs/prompts
    } catch (error) {
      console.error(
        `Error generating JSON schema for function ${aiFunction.name}:`,
        error,
      );
      // Fallback schema indicating an error
      return JSON.stringify({
        error: "Could not generate response schema",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Constructs the final prompt string to be sent to the LLM for executing
   * an AI function step.
   *
   * @param context - The current AgentContext containing all necessary information.
   * @returns The fully rendered prompt string.
   * @throws {Error} If required context information is missing or rendering fails.
   */
  public static buildExecuteFunctionPrompt(context: AgentContext): string {
    const functionDef = context.getFunctionDefinition(context.request.name); // Get the target function

    // 1. Prepare Tool Definitions String
    const toolsString =
      Array.from(context.toolDefinitions.values())
        .map((tool) => tool.toString()) // Use the tool's built-in string representation
        .join("\n\n") || "Инструменты не доступны."; // Provide fallback text

    // 2. Prepare History String
    const historyString = context.history.getLimitedMessagesAsString(
      context.config.historyLimit,
    );

    // 3. Prepare State String
    const stateString = JSON.stringify(context.state ?? {}); // Ensure state is always an object string

    // 4. Prepare Response Schema String
    const responseSchemaString = this.buildResponseSchema(functionDef);

    // 5. Prepare User Query String (Render the function-specific template)
    let userQueryString: string;
    try {
      // Ensure input is treated as FunctionVariables
      const inputVariables = context.request.input as FunctionVariables;
      userQueryString = functionDef.promptTemplate.render(inputVariables);
    } catch (error) {
      throw new Error(
        `Failed to render user query template for function "${functionDef.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // 6. Assemble Prompt Variables
    const promptVars: ExecuteFunctionPromptVars = {
      tools: toolsString,
      history: historyString,
      state: stateString,
      responseSchema: responseSchemaString,
      userQuery: userQueryString,
    };

    // 7. Render the Main Template
    try {
      const finalPrompt = EXECUTE_FUNCTION_TEMPLATE.render(promptVars);
      return finalPrompt.trim(); // Return the final, trimmed prompt
    } catch (error) {
      throw new Error(
        `Failed to render the main execution prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parses the raw string response from the LLM into a structured LlmResponse object.
   * Includes robust handling for JSON extraction from markdown code blocks.
   * Validates the basic structure including the presence and type of the `_type` field.
   *
   * @param rawResponse - The raw text response from the LLM.
   * @returns An LlmResponse object (success, error, or call_tool).
   *          Returns an error type response if parsing or basic validation fails.
   */
  public static parseLlmResponse(rawResponse: string): LlmResponse<unknown> {
    if (!rawResponse) {
      return {
        _type: "error",
        _message: "LLM returned an empty response.",
      };
    }

    let jsonString: string | null = null;
    try {
      // Regex to find JSON within ```json ... ``` blocks or as a standalone object/array
      const jsonMatch = rawResponse
        .trim()
        .match(/```json\s*([\s\S]*?)\s*```|^\s*({[\s\S]*}|\[[\s\S]*\])\s*$/);

      if (jsonMatch) {
        // Prioritize the content within ```json block if present
        jsonString = jsonMatch[1] ?? jsonMatch[2];
      }

      if (!jsonString) {
        // Fallback: Try to parse the whole string directly
        try {
          JSON.parse(rawResponse.trim()); // Check if the whole thing is valid JSON
          jsonString = rawResponse.trim();
        } catch {
          console.error(
            "LLM response does not contain a recognizable JSON structure:",
            rawResponse,
          );
          return {
            _type: "error",
            _message: "LLM response is not valid JSON or JSON block.",
          };
        }
      }

      // Parse the extracted JSON string
      const parsedJson = JSON.parse(jsonString);

      // *** ADDED VALIDATION STEP ***
      // Validate the parsed JSON against the basic LlmResponseSchema structure
      const validationResult = LlmResponseSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        console.error(
          "Parsed LLM response failed basic structure validation:",
          validationResult.error.issues,
          "Parsed Data:",
          parsedJson,
        );
        return {
          _type: "error",
          _message: `Parsed JSON does not match expected structure: ${validationResult.error.issues.map((iss) => iss.message).join(', ')}`,
          _invalidData: parsedJson,
        };
      }

      // If validation passes, return the data (which now definitely has a valid _type)
      // The specific _data validation happens later in the validationMiddleware
      return validationResult.data as LlmResponse<unknown>;

    } catch (error) {
      // Catch JSON.parse errors or other unexpected errors during processing
      console.error("Failed to parse LLM response:", rawResponse, error);
      return {
        _type: "error",
        _message: `Failed to parse LLM response JSON: ${error instanceof Error ? error.message : String(error)}`,
        _invalidData: jsonString, // Log the string that failed to parse if possible
      };
    }
  }
}