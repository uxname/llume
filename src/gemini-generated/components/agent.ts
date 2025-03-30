import { z } from "zod";
import {
  AgentContext,
  AgentPipeline,
  // Use 'type' keyword for type-only imports
  type FinalHandlerFn,
  type StepRequest,
  type StepResponse,
  type StepType,
  type AgentConfig,
} from "../core"; // Core components
import {
  DefinitionNotFoundError,
  LlmError,
  MaxIterationsError,
  ToolExecutionError,
  ValidationError,
  AgentError,
} from "../core";
import type { MiddlewareFn } from "../types";
import type { LLMProvider } from "./llm-provider.ts";
// Import History as value
import { History } from "./history.ts";
import type { AiFunctionDefinition } from "./ai-function.ts";
import type { ToolDefinition } from "./tool.ts";
// Import the actual PromptBuilder class
import { PromptBuilder } from "../prompts";
// Import LlmResponse and FunctionVariables as types
import { type LlmResponse, type FunctionVariables } from "../schemas"; // Common response schemas

// REMOVE THE PLACEHOLDER DefaultPromptBuilder OBJECT
// const DefaultPromptBuilder = { ... };

// Use the imported PromptBuilder directly
const ActualPromptBuilder = PromptBuilder;

/**
 * Default configuration for the Agent.
 */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 5,
  historyLimit: 10,
};

/**
 * The main orchestrator for executing AI functions and tools.
 * Manages state, history, middleware pipeline, and the execution loop.
 */
export class Agent<TState extends Record<string, any> = Record<string, any>> {
  public readonly config: Readonly<AgentConfig>;
  public readonly llmProvider: LLMProvider;
  private readonly functionDefinitions: Map<string, AiFunctionDefinition>;
  private readonly toolDefinitions: Map<string, ToolDefinition>;
  private readonly pipeline: AgentPipeline;
  private readonly initialStateFactory: () => TState;

  constructor(
    llmProvider: LLMProvider,
    config?: Partial<AgentConfig>,
    initialStateFactory?: () => TState,
  ) {
    this.llmProvider = llmProvider;
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    this.initialStateFactory = initialStateFactory ?? (() => ({}) as TState);
    this.functionDefinitions = new Map();
    this.toolDefinitions = new Map();
    this.pipeline = new AgentPipeline();

    // Basic validation for config
    if (this.config.historyLimit < 2) {
      console.warn(
        "AgentConfig: historyLimit must be at least 2. Setting to 2.",
      );
      this.config = { ...this.config, historyLimit: 2 };
    }
    if (this.config.maxIterations < 1) {
      console.warn(
        "AgentConfig: maxIterations must be at least 1. Setting to 1.",
      );
      this.config = { ...this.config, maxIterations: 1 };
    }
  }

  /**
   * Registers an AI Function definition with the Agent.
   * @param definition - The AiFunctionDefinition instance.
   */
  addFunction(
    definition: AiFunctionDefinition<z.ZodTypeAny, z.ZodTypeAny>,
  ): this {
    if (this.functionDefinitions.has(definition.name)) {
      console.warn(`Overwriting function definition for "${definition.name}"`);
    }
    this.functionDefinitions.set(definition.name, definition);
    return this;
  }

  /**
   * Registers a Tool definition with the Agent.
   * @param definition - The ToolDefinition instance.
   */
  addTool(definition: ToolDefinition<z.ZodTypeAny, unknown>): this {
    if (this.toolDefinitions.has(definition.name)) {
      console.warn(`Overwriting tool definition for "${definition.name}"`);
    }
    this.toolDefinitions.set(definition.name, definition);
    return this;
  }

  /**
   * Adds a global middleware function to the Agent's pipeline.
   * Middleware will run for every step (LLM call or Tool execution).
   * @param middleware - The MiddlewareFn to add.
   */
  use(middleware: MiddlewareFn): this {
    this.pipeline.use(middleware);
    return this;
  }

  /**
   * Executes an AI Function, potentially involving multiple steps (LLM calls and Tool uses).
   * Manages the conversation history and state throughout the execution.
   *
   * @param functionName - The name of the initial AI Function to execute.
   * @param initialInput - The input data for the initial function call.
   * @param executionOptions - Optional overrides for this specific execution.
   * @returns A promise resolving to the final successful output of the function.
   * @throws {DefinitionNotFoundError} If the initial function is not found.
   * @throws {ValidationError} If the initial input is invalid.
   * @throws {MaxIterationsError} If the maximum number of iterations is reached.
   * @throws {LlmError} If the LLM returns an error or fails.
   * @throws {ToolExecutionError} If a tool fails during execution.
   * @throws {AgentError} For other generic agent errors.
   */
  async execute<TInput extends FunctionVariables, TOutput>(
    functionName: string,
    initialInput: TInput,
    // executionOptions?: Partial<AgentConfig> // TODO: Allow per-execution overrides?
  ): Promise<TOutput> {
    const initialFunctionDef = this.functionDefinitions.get(functionName);
    if (!initialFunctionDef) {
      throw new DefinitionNotFoundError("Function", functionName);
    }

    // 1. Validate Initial Input
    try {
      initialFunctionDef.inputSchema.parse(initialInput);
    } catch (error) {
      throw new ValidationError(
        `Initial input validation failed for function "${functionName}"`,
        error instanceof z.ZodError ? error.issues : error,
      );
    }

    // 2. Initialize Execution State
    const history = new History();
    let state = this.initialStateFactory();
    let currentResponse: StepResponse<unknown> | undefined = undefined;
    let nextStep: StepRequest<unknown> = {
      type: "llm",
      name: functionName,
      input: initialInput,
    };
    let iteration = 0;

    // Add initial user query to history (if applicable based on template)
    // Note: History management should ideally be handled by middleware.
    // This is a simplified initial message addition.
    try {
      // Use the imported PromptBuilder directly here if needed, or rely on the final handler
      const initialQuery = initialFunctionDef.promptTemplate
        .render(initialInput)
        .trim();
      if (initialQuery) {
        history.addMessage({ role: "user", content: initialQuery });
      }
    } catch (renderError) {
      console.warn("Could not render initial prompt for history:", renderError);
    }

    // 3. Execution Loop
    while (iteration < this.config.maxIterations) {
      iteration++;

      // 3.1 Create Context for the step
      const context = new AgentContext(
        nextStep, // Request for this step
        state, // Current state
        history, // History object
        this.functionDefinitions,
        this.toolDefinitions,
        this.llmProvider,
        this.config,
      );

      // 3.2 Run the pipeline (Middleware + Final Handler)
      const finalHandler = this.createFinalHandler(nextStep.type);
      await this.pipeline.run(context, finalHandler);

      // 3.3 Process Pipeline Result
      if (context.error) {
        // Handle errors that occurred within the pipeline (middleware or final handler)
        // Specific error types might have been thrown by the final handler or middleware
        if (context.error instanceof AgentError) throw context.error;
        // Wrap non-Agent errors
        throw new AgentError(
          `Error during step ${iteration} (${nextStep.type}:${nextStep.name}): ${context.error.message}`,
        );
      }

      currentResponse = context.response; // Get the response set by the final handler/middleware
      state = context.state; // Update state potentially modified by middleware

      // 3.4 Analyze response and determine next step or finish
      if (nextStep.type === "llm") {
        const llmResponse = currentResponse as LlmResponse<unknown>; // Cast based on step type

        if (!llmResponse) {
          // This case should ideally be prevented by parseLlmResponse returning an error payload
          throw new AgentError(
            `LLM step (${nextStep.name}) completed without a response object.`,
          );
        }

        switch (llmResponse._type) {
          case "success":
            try {
              // Validate LLM success output against the *target function's* output schema
              const targetFunction = this.functionDefinitions.get(
                nextStep.name, // The function that was just called
              );
              if (!targetFunction)
                throw new DefinitionNotFoundError("Function", nextStep.name); // Should not happen

              const validatedData = targetFunction.outputSchema.parse(
                llmResponse._data,
              );
              return validatedData as TOutput; // SUCCESS! Return the final validated data.
            } catch (error) {
              // Validation failed. Prepare for another LLM call with error info.
              // History middleware should ideally add this error message.
              console.error(
                `LLM output validation failed for function "${nextStep.name}":`,
                error,
              );
              // We need to loop again, asking the LLM to fix its output.
              // The history should now contain the invalid assistant response and a user message (added by middleware)
              // indicating the validation error.
              // The next step remains an LLM call to the same function.
              nextStep = {
                type: "llm",
                name: nextStep.name, // Retry the same function
                input: nextStep.input, // Usually the same input, but could be modified by state/middleware
              };
              // Add error message to history (TEMPORARY - move to middleware)
              // Consider how validation errors should trigger history updates via middleware
              history.addMessage({
                role: "user", // Simulate user asking for correction
                content: `Assistant response validation failed: ${error instanceof z.ZodError ? error.message : String(error)}. Please correct the output. Invalid data: ${JSON.stringify(llmResponse._data)}`,
              });
            }
            break; // Continue loop for retry

          case "error":
            // Throw an error based on the LLM's reported issue
            throw new LlmError(
              `LLM returned an error for function "${nextStep.name}": ${llmResponse._message}`,
              llmResponse, // Include the full error payload as details
            );

          case "call_tool":
            // Prepare for a tool execution step
            nextStep = {
              type: "tool",
              name: llmResponse._toolName,
              input: llmResponse._input,
            };
            break; // Continue loop for tool call

          default:
            // This case should now be unreachable if parseLlmResponse works correctly
            // But keep it as a safeguard
            throw new AgentError(
              `Received unknown response type from LLM: ${
                (llmResponse as any)?._type // Use 'any' cast carefully for logging unknown types
              }`,
            );
        }
      } else if (nextStep.type === "tool") {
        // Tool execution was successful (pipeline didn't throw).
        // The tool's raw output is in currentResponse.
        // History middleware should have added the tool response message.
        // Prepare for the next LLM call to process the tool result.
        nextStep = {
          type: "llm",
          name: functionName, // Go back to the original function llm-request
          input: initialInput, // Or potentially modified input based on state/logic
        };
        // Note: The history now contains the tool result, so the LLM
        // in the next iteration will see it and continue the task.
      } else {
        // Should be unreachable
        throw new AgentError(`Invalid step type encountered: ${nextStep.type}`);
      }
    } // End of loop

    // 4. Handle Max Iterations Reached
    throw new MaxIterationsError(
      `Agent failed to complete function "${functionName}" within ${this.config.maxIterations} iterations.`,
      this.config.maxIterations,
    );
  }

  /**
   * Creates the final handler function for the pipeline run, responsible for
   * executing the core logic of either an LLM call or a Tool execution.
   */
  private createFinalHandler(stepType: StepType): FinalHandlerFn {
    return async (context: AgentContext): Promise<void> => {
      if (stepType === "llm") {
        // --- LLM Final Handler ---
        const functionDef = context.getFunctionDefinition(context.request.name); // Throws if not found
        let rawResponse: string;
        try {
          // Build prompt using potentially updated llm-request (state, history)
          // Use the imported and corrected PromptBuilder directly
          const prompt =
            ActualPromptBuilder.buildExecuteFunctionPrompt(context);
          rawResponse = await context.llmProvider.execute(prompt);
        } catch (error) {
          // Catch errors from LLM execution
          throw new LlmError(
            `LLM provider "${context.llmProvider.name}" failed during execute`,
            error,
          );
        }

        // Parse and perform basic structure check using the imported/corrected PromptBuilder
        // This will now return an ErrorPayload if _type is missing or invalid
        context.response = ActualPromptBuilder.parseLlmResponse(rawResponse);

        // If parsing itself failed and returned an error payload,
        // the agent loop will handle it in the 'case "error":' block.
        // No need for extra try-catch here for parsing itself,
        // as parseLlmResponse handles its internal errors.
      } else if (stepType === "tool") {
        // --- Tool Final Handler ---
        const toolDef = context.getToolDefinition(context.request.name); // Throws if not found
        let toolInput: z.infer<typeof toolDef.inputSchema>;

        try {
          // Validate tool input before execution
          toolInput = toolDef.inputSchema.parse(context.request.input);
        } catch (error) {
          // Throw validation error to be caught by pipeline runner
          throw new ValidationError(
            `Tool input validation failed for tool "${toolDef.name}"`,
            error instanceof z.ZodError ? error.issues : error,
          );
        }

        try {
          // Execute the tool's logic, passing the llm-request
          context.response = await toolDef.execute(toolInput, context);
          // Optional: Output validation could happen here or preferably in validationMiddleware
        } catch (error) {
          // Catch errors specifically from tool execution
          // Wrap in ToolExecutionError to be caught by pipeline runner
          throw new ToolExecutionError(
            `Tool "${toolDef.name}" execution failed: ${error instanceof Error ? error.message : String(error)}`,
            toolDef.name,
            toolInput,
            error instanceof Error ? error : undefined,
          );
        }
      } else {
        // Should be unreachable
        throw new AgentError(`Invalid step type in final handler: ${stepType}`);
      }
    };
  }
}
