/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { BaseTool } from "../tool/base-tool";
import type { ToolCallResult } from "../tool/types";
import type { Message } from "./types";

export interface LlmRequestParams {
  query: string;
  variables: Record<string, string>;
  schema: z.ZodType;
  tools?: BaseTool[];
  state?: any;
  history?: Message[];
  toolsCallHistory?: ToolCallResult[];
}

export class LlmRequest {
  public query: string;
  public variables: Record<string, string>;
  public successResponseSchema: z.ZodType;
  public tools?: BaseTool[];
  public state?: any;
  public history: Message[];
  public toolsCallHistory: ToolCallResult[];

  constructor(data: LlmRequestParams) {
    const tools = data.tools === undefined ? [] : data.tools;
    const history = data.history === undefined ? [] : data.history;
    const toolsCallHistory =
      data.toolsCallHistory === undefined ? [] : data.toolsCallHistory;
    this.query = data.query;
    this.variables = data.variables;
    this.successResponseSchema = data.schema;
    this.tools = tools;
    this.state = data.state;
    this.history = history;
    this.toolsCallHistory = toolsCallHistory;
  }
}
