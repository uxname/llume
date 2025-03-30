// src/core/agent-context.ts
import type { History } from "../components/history"; // Placeholder
import type { LLMProvider } from "../components/llm-provider"; // Placeholder
import type { AiFunctionDefinition } from "../components/ai-function"; // Placeholder
import type { ToolDefinition } from "../components/tool"; // Placeholder
import type { LlmResponse } from "../schemas/common"; // Placeholder
import { DefinitionNotFoundError } from "./errors"; // Import the error class

/**
 * Represents the type of step being executed in the pipeline.
 */
export type StepType = "llm" | "tool";

/**
 * Contains information about the specific request for the current step.
 */
export interface StepRequest<TInput = unknown> {
  type: StepType;
  name: string; // Name of the function or tool
  input: TInput;
}

/**
 * Contains information about the response from the current step.
 */
export type StepResponse<TOutput = unknown> =
  | LlmResponse<TOutput> // If step type was 'llm'
  | TOutput // If step type was 'tool'
  | undefined; // Before the step completes or if there's an error

/**
 * Configuration for the Agent execution.
 */
export interface AgentConfig {
  maxIterations: number;
  historyLimit: number;
  // Add other config options as needed
}

/**
 * Holds all relevant data for a single step execution within the Agent.
 * This object is passed through the middleware pipeline and can be modified.
 */
export class AgentContext<
  TState extends Record<string, any> = Record<string, any>,
  TInput = unknown,
  TOutput = unknown,
> {
  /** Information about the request for the current step (LLM call or Tool execution). */
  public request: StepRequest<TInput>;

  /** The result of the current step (LLM response or Tool output). Undefined until the step completes successfully. */
  public response: StepResponse<TOutput> = undefined;

  /** Shared state object accessible and modifiable across different steps within a single `agent.execute` call. */
  public state: TState;

  /** The conversation history manager. */
  public readonly history: History;

  /** Definitions of all AI Functions available to the Agent. */
  public readonly functionDefinitions: ReadonlyMap<
    string,
    AiFunctionDefinition
  >;

  /** Definitions of all Tools available to the Agent. */
  public readonly toolDefinitions: ReadonlyMap<string, ToolDefinition>;

  /** The LLM provider instance used for this execution. */
  public readonly llmProvider: LLMProvider;

  /** Configuration settings for the current Agent execution. */
  public readonly config: Readonly<AgentConfig>;

  /** Stores any error that occurred during the execution of the current step or its middleware. */
  public error?: Error = undefined;

  /** Internal properties or flags used by the Agent or middleware */
  public _internal: Record<string, any> = {};

  constructor(
    request: StepRequest<TInput>,
    initialState: TState,
    history: History,
    functionDefinitions: Map<string, AiFunctionDefinition>,
    toolDefinitions: Map<string, ToolDefinition>,
    llmProvider: LLMProvider,
    config: AgentConfig,
  ) {
    this.request = request;
    this.state = initialState;
    this.history = history;
    this.functionDefinitions = functionDefinitions;
    this.toolDefinitions = toolDefinitions;
    this.llmProvider = llmProvider;
    this.config = config;
  }

  /**
   * Helper to get a specific function definition.
   * @throws {DefinitionNotFoundError} if the function is not found.
   */
  public getFunctionDefinition(name: string): AiFunctionDefinition {
    const definition = this.functionDefinitions.get(name);
    if (!definition) {
      throw new DefinitionNotFoundError("Function", name);
    }
    return definition;
  }

  /**
   * Helper to get a specific tool definition.
   * @throws {DefinitionNotFoundError} if the tool is not found.
   */
  public getToolDefinition(name: string): ToolDefinition {
    const definition = this.toolDefinitions.get(name);
    if (!definition) {
      throw new DefinitionNotFoundError("Tool", name);
    }
    return definition;
  }

  /**
   * Updates the shared state by merging the provided partial state.
   * @param partialState - An object containing state properties to add or overwrite.
   */
  public updateState(partialState: Partial<TState>): void {
    this.state = { ...this.state, ...partialState };
  }
}
