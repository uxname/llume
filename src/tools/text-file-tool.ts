import * as fs from "node:fs/promises";

export class TextFileTool {
    static async load(path: string): Promise<string> {
        return await fs.readFile(path, "utf-8");
    }

    static async save(path: string, content: string): Promise<void> {
        await fs.writeFile(path, content);
    }
}