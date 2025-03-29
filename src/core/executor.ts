/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExecutionContext } from "./execution-context.ts";
import type { FunctionVariables } from "./ai-function.ts";
import { PromptBuilder } from "./prompt/prompt-builder.ts";
import type {
  SuccessPayload,
  ToolCallPayload,
  ErrorPayload,
  LlmResponse,
} from "./prompt/schemas.ts";
import type { HistoryMessage } from "./history.ts";
import { EventType } from "./prompt/schemas.ts";

export class Executor extends ExecutionContext {
  async executeSingleFunction<
    TInput extends FunctionVariables,
    TOutput extends FunctionVariables,
  >(
    functionName: string,
    input: TInput,
  ): Promise<LlmResponse<unknown | TOutput>> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`Function ${functionName} not found`);
    }

    await aiFunction.runMiddleware(
      {
        type: EventType.LLM_REQUEST,
        initiator: "user",
        functionName: functionName,
        input: input,
        timestamp: Date.now(),
      },
      this,
    );

    const prompt = PromptBuilder.buildExecuteFunctionPrompt(
      this,
      aiFunction,
      input,
      aiFunction.tools ?? [],
    );

    const rawResponse = await aiFunction.llm.execute(prompt);
    let parsedResponse: LlmResponse<TOutput | unknown>;

    // --- Парсинг ответа (без изменений) ---
    try {
      const jsonMatch = rawResponse.match(
        /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/,
      );
      if (!jsonMatch || (!jsonMatch[1] && !jsonMatch[2])) {
        console.error(
          "LLM response does not contain a recognizable JSON structure:",
          rawResponse,
        );
        parsedResponse = {
          _type: "error",
          _message: "LLM response is not valid JSON.",
        };
      } else {
        const jsonString = jsonMatch[1] || jsonMatch[2];
        parsedResponse = JSON.parse(jsonString) as LlmResponse<TOutput>;
      }
    } catch (error) {
      console.error("Failed to parse LLM response:", rawResponse, error);
      parsedResponse = {
        _type: "error",
        _message: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    // ------------------------------------

    // --- ДОБАВЛЕНО: Вызываем middleware после ответа LLM ---
    await aiFunction.runMiddleware(
      {
        type: EventType.LLM_RESPONSE,
        initiator: "llm",
        functionName: functionName,
        input: input, // Можно передать input, который привел к этому ответу
        output: parsedResponse, // Передаем распарсенный ответ
        timestamp: Date.now(),
      },
      this,
    ); // Передаем текущий ExecutionContext
    // ----------------------------------------------------

    return parsedResponse;
  }

  async callTool<
    TInput extends FunctionVariables,
    TOutput extends FunctionVariables,
  >(functionName: string, toolName: string, input: TInput): Promise<TOutput> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`[callTool] Function ${functionName} not found`);
    }

    const tool = aiFunction.tools?.find((t) => t.name === toolName);
    if (!tool) {
      this.addHistoryMessage({
        role: "assistant",
        content: {
          _type: "error",
          _message: `Tool '${toolName}' requested by the assistant was not found in function '${functionName}'.`,
        },
      });
      throw new Error(
        `[callTool] Tool ${toolName} not found in function ${functionName}`,
      );
    }

    try {
      const result = await tool.execute(input, this);
      try {
        tool.outputSchema.parse(result);
      } catch (validationError) {
        console.error(
          `[callTool] Tool ${toolName} output validation failed:`,
          validationError,
        );
        this.addHistoryMessage({
          role: "user",
          toolResponse: {
            toolName: toolName,
            toolResponse: {
              _type: "tool_execution_error",
              _message: `Tool output validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
              _invalidOutput: result,
            },
          },
        });
        throw new Error(`Tool ${toolName} output validation failed.`);
      }
      return result as TOutput;
    } catch (error) {
      // Handle errors thrown either by tool.execute or by the validation block above
      // But only add history message if it wasn't added by the validation block already
      if (
        !(
          error instanceof Error &&
          error.message.includes("output validation failed")
        )
      ) {
        console.error(`[callTool] Error executing tool ${toolName}:`, error);
        this.addHistoryMessage({
          role: "user",
          toolResponse: {
            toolName: toolName,
            toolResponse: {
              _type: "tool_execution_error",
              _message: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          },
        });
      }
      throw error;
    }
  }

  async smartExecute<
    TInput extends FunctionVariables,
    TOutput extends FunctionVariables,
  >(
    functionName: string,
    initialInput: TInput,
    maxIterations: number = 5,
  ): Promise<TOutput> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`[smartExecute] Function ${functionName} not found`);
    }

    // --- Start: Integrated preRunMiddleware functionality ---
    // Potential location for actions that needed to happen *before* the first LLM call
    // e.g., Initial input validation
    try {
      aiFunction.inputSchema.parse(initialInput);
    } catch (validationError) {
      console.error(
        "[smartExecute] Initial input validation failed:",
        validationError,
      );
      throw new Error(
        `Initial input validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
      );
    }
    // Other pre-run logic could be added here if needed (logging, setup etc.)
    // --- End: Integrated preRunMiddleware functionality ---

    const currentInput = { ...initialInput }; // Не используется напрямую в цикле, т.к. input передается в executeSingleFunction
    let iteration = 0;
    const initialUserQuery = aiFunction.promptTemplate
      .render<TInput>(initialInput)
      .trim();

    if (initialUserQuery) {
      if (
        this.executionHistory.messages.length === 0 ||
        JSON.stringify(
          this.executionHistory.messages[
            this.executionHistory.messages.length - 1
          ],
        ) !== JSON.stringify({ role: "user", content: initialUserQuery })
      ) {
        this.addHistoryMessage({
          role: "user",
          content: initialUserQuery,
        });
      }
    }

    while (iteration < maxIterations) {
      iteration++;

      const result: LlmResponse<TOutput | unknown> =
        await this.executeSingleFunction(functionName, currentInput);

      this.addHistoryMessage({
        role: "assistant",
        content: result,
      });

      // --- Start: Integrated postRunMiddleware functionality ---
      // Potential location for actions needed *after* each LLM call but *before* processing
      // e.g., Logging the raw LLM response
      // console.log("Raw LLM Response:", result);
      // Other post-run logic could be added here (e.g. generic checks on 'result')
      // --- End: Integrated postRunMiddleware functionality ---

      switch (result._type) {
        case "success":
          try {
            aiFunction.outputSchema.parse(result._data);
            return result._data as TOutput;
          } catch (validationError) {
            console.error(
              `[smartExecute] LLM output validation failed:`,
              validationError,
            );
            this.addHistoryMessage({
              role: "user",
              content: {
                _type: "error",
                _message: `Assistant response validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}. The invalid data was: ${JSON.stringify(result._data)}`,
              },
            });
            if (iteration === maxIterations) {
              throw new Error(
                `LLM output validation failed after ${maxIterations} iterations.`,
              );
            }
          }
          break;

        case "error":
          console.error(
            `[smartExecute] LLM returned an error: ${result._message}`,
          );
          throw new Error(`LLM execution failed: ${result._message}`);

        case "call_tool":
          try {
            const toolResult = await this.callTool(
              functionName,
              result._toolName,
              result._input,
            );

            this.addHistoryMessage({
              role: "user",
              toolResponse: {
                toolName: result._toolName,
                toolResponse: toolResult,
              },
            });
          } catch (toolError) {
            console.error(
              `[smartExecute] Tool call failed: ${toolError instanceof Error ? toolError.message : String(toolError)}. Aborting execution.`,
            );
            throw new Error(
              `Tool execution failed for '${result._toolName}': ${toolError instanceof Error ? toolError.message : String(toolError)}`,
            );
          }
          break;

        default: {
          const unknownType = (result as { _type: string })?._type;
          console.error(
            `[smartExecute] Received unknown result type from LLM: ${unknownType}`,
          );
          throw new Error(`Unknown LLM result type: ${unknownType}`);
        }
      }
    }

    throw new Error(
      `[smartExecute] Failed to reach a final answer after ${maxIterations} iterations.`,
    );
  }
}
