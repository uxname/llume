import type { LlmRequest } from "../llm-request/llm-request";
import type { LlmResponse } from "../llm-response/types";

export enum RequestTarget {
  LLM = "llm",
  TOOL = "tool",
}

export interface Execution {
  executionDate: Date;

  requestTarget: RequestTarget;

  toolName?: string;
  input: unknown;
  response: LlmResponse;
}

export class Pipeline {
  public executions: Execution[] = [];
  public llmRequest: LlmRequest;

  constructor(request: LlmRequest) {
    this.llmRequest = {
      // prevent mutation
      ...request,
    };
  }

  addExecution(
    requestType: RequestTarget,
    input: unknown,
    response: LlmResponse,
    toolName?: string,
  ) {
    this.executions.push({
      executionDate: new Date(),
      requestTarget: requestType,
      toolName,
      input,
      response,
    });
  }
}
