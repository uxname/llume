// src/core/errors.ts

/**
 * Base class for specific agent errors.
 */
export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error during input or output validation.
 */
export class ValidationError extends AgentError {
  public details?: unknown; // e.g., Zod error issues

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

/**
 * Error originating from the LLM provider.
 */
export class LlmError extends AgentError {
  public providerDetails?: unknown; // e.g., API error response

  constructor(message: string, providerDetails?: unknown) {
    super(message);
    this.providerDetails = providerDetails;
  }
}

/**
 * Error during the execution of a tool.
 */
export class ToolExecutionError extends AgentError {
  public toolName: string;
  public input?: unknown;
  public causeError?: Error; // The original error thrown by the tool

  constructor(
    message: string,
    toolName: string,
    input?: unknown,
    causeError?: Error,
  ) {
    super(message);
    this.toolName = toolName;
    this.input = input;
    this.causeError = causeError;
  }
}

/**
 * Error when the maximum number of execution iterations is reached.
 */
export class MaxIterationsError extends AgentError {
  public iterations: number;

  constructor(message: string, iterations: number) {
    super(message);
    this.iterations = iterations;
  }
}

/**
 * Error when a required function or tool definition is not found.
 */
export class DefinitionNotFoundError extends AgentError {
  constructor(type: "Function" | "Tool", name: string) {
    super(`${type} definition not found: ${name}`);
  }
}
