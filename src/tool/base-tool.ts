import { z } from "zod";

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodSchema;
  abstract readonly outputSchema: z.ZodSchema;
}
