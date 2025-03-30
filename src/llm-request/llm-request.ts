import { z } from "zod";
import { BaseTool } from "../tool/base-tool.ts";

export class LlmRequest {
  constructor(
    public userQuery: string,
    public successResponseSchema: z.ZodType,
    public tools?: BaseTool[],
  ) {}
}
