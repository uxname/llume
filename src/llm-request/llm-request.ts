/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { BaseTool } from "../tool/base-tool";
import type { ToolCallResult } from "../tool/types";
import type { Message } from "./types";

export class LlmRequest {
  constructor(
    public userQuery: string,
    public successResponseSchema: z.ZodType,
    public tools?: BaseTool[],
    public state?: any,
    public history: Message[] = [],
    public toolsCallHistory: ToolCallResult[] = [],
  ) {}
}
