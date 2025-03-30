/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { BaseTool } from "../tool/base-tool.ts";
import type { ToolCallResult } from "../tool/types.ts";

export class LlmRequest {
  constructor(
    public userQuery: string,
    public successResponseSchema: z.ZodType,
    public tools?: BaseTool[],
    public state?: any,
    public toolsCallHistory?: ToolCallResult[],
  ) {}
}
