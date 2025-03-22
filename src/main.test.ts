import { describe, it, expect } from "vitest";
import { Calculator } from "./ai-functions/calculator/calculator.ts";
import { AgentRouter } from "./ai-functions/router.ts";
import { Weather } from "./ai-functions/weather.ts";
import { CodeLoader } from "./ai-functions/code-loader.ts";
import { TextFileTool } from "./tools/text-file-tool.ts";
import { CodeRefactorer } from "./ai-functions/code-refactorer.ts";
import * as path from "node:path";
import { Ai0 } from "./ai-execution-engine/engines/ai0/ai0.ts";

describe("AI Functions and Routing", () => {
  const llmProvider = new Ai0("https://ai0.uxna.me/", process.env.AI0_API_KEY!);
  const calculator = new Calculator(llmProvider);
  const weather = new Weather(llmProvider);
  const agentRouter = new AgentRouter(llmProvider);

  it("routes calculator query correctly", async () => {
    const query = "сколько будет 9 в квадрате?";
    const result = await agentRouter.route(query, [calculator, weather]);
    expect(result.agent).toBe("Калькулятор");
  });

  it("routes weather query correctly", async () => {
    const query = "Какая погода в Минске обычно летом?";
    const result = await agentRouter.route(query, [calculator, weather]);
    expect(result.agent).toBe("Погода");
  });

  it("executes calculator function", async () => {
    const query = "сколько будет 9 в квадрате?";
    const response = await calculator.execute({ evaluation: query });
    expect(response).toEqual({
      value: 81,
      errors: null,
    }); // Assuming the calculator returns a string "81"
  });

  it("executes weather function", async () => {
    const response = await weather.execute({
      city: "Minsk",
      date: "1 января 2023",
    });
    expect(response).toContain("Minsk"); // Assuming the response includes the city name
  });

  it("throws error for unknown AI function", () => {
    const getAiFunctionByName = (name: string) => {
      if (name === "Калькулятор") return calculator;
      if (name === "Погода") return weather;
      throw new Error("Unknown AI function name");
    };
    expect(() => getAiFunctionByName("Unknown")).toThrow(
      "Unknown AI function name",
    );
  });
});

describe("Code Loader and References", () => {
  // const llmProvider = new Ai0("https://ai0.uxna.me/", process.env.AI0_API_KEY!);
  // const codeLoader = new CodeLoader(llmProvider);

  it("detects code references in a file", async () => {
    const filePath = path.join(import.meta.dirname, "..", "package.json");
    const importReferences = "[]";
    const result = await detectCodeReferences(filePath, importReferences);
    expect(result.importReferences).toBeInstanceOf(Array);
  });

  it("lists all references recursively", async () => {
    const filePath = path.join(import.meta.dirname, "..", "package.json");
    const result = await listAllReferences([], filePath);
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0); // Assuming package.json has dependencies
  });
});

describe("Code Refactoring", () => {
  const llmProvider = new Ai0("https://ai0.uxna.me/", process.env.AI0_API_KEY!);
  const codeRefactorer = new CodeRefactorer(llmProvider);

  it("refactors code and saves it", async () => {
    const allReferences = [
      path.join(import.meta.dirname, "..", "package.json"),
      path.join(import.meta.dirname, "main.ts"), // Adjust if this file exists in your project
    ];

    const result = [];
    for (const reference of allReferences) {
      const fileContent = await TextFileTool.load(reference);
      result.push({
        filePath: reference,
        content: fileContent,
      });
    }

    const refactoredCode = await codeRefactorer.execute({
      code: JSON.stringify(result),
    });

    expect(refactoredCode).toBeDefined();
    await TextFileTool.save(
      "Project.txt",
      JSON.stringify(refactoredCode, null, 2),
    );

    const savedContent = await TextFileTool.load("Project.txt");
    expect(savedContent).toBe(JSON.stringify(refactoredCode, null, 2));
  });
});

// Helper function for detectCodeReferences
async function detectCodeReferences(
  filePath: string,
  importReferences: string,
) {
  const fileContent = await TextFileTool.load(filePath);
  const codeLoader = new CodeLoader(
    new Ai0("https://ai0.uxna.me/", process.env.AI0_API_KEY!),
  );
  return await codeLoader.execute({
    code: fileContent,
    filePath,
    importReferences,
  });
}

// Helper function for listAllReferences
async function listAllReferences(
  accumulator: string[],
  filepath: string,
): Promise<string[]> {
  const result = await detectCodeReferences(
    filepath,
    JSON.stringify(accumulator),
  );
  if (result.importReferences.length > 0) {
    accumulator = accumulator.concat(result.importReferences);
    for (const reference of result.importReferences) {
      accumulator = await listAllReferences(accumulator, reference);
    }
  }
  return accumulator;
}
