import { describe, expect, test } from "vitest";
import { ExecutionContext } from "./core/execution-context.ts";

describe("example", () => {
  test("should work", () => {
    const area = new ExecutionContext();

    expect(area).toBeDefined();
  });
});
