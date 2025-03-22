export interface LLMRequestParams {
  prompt: string;
  log?: boolean;
}

export abstract class LlmProviderBase {
  abstract name: string;

  protected async query(params: LLMRequestParams): Promise<string> {
    const shouldLog = params.log ?? true;
    if (shouldLog) {
      this.logRequest(params.prompt);
    }

    const response = await this.generateResponse(params);

    if (shouldLog) {
      this.logResponse(response);
    }

    return response;
  }

  protected abstract generateResponse(
    params: LLMRequestParams,
  ): Promise<string>;

  protected log(color: LogColor = LogColor.White, ...messages: unknown): void {
    const colorCode = this.getColorCode(color);
    console.log(colorCode, messages[0], "\x1b[0m", ...messages.slice(1));
  }

  protected logRequest(prompt: string): void {
    this.log(LogColor.Blue, `<<${this.name} REQUEST>>\n${prompt}\n`);
  }

  protected logResponse(response: string): void {
    this.log(LogColor.Green, `<<${this.name} RESPONSE>>`, response);
  }

  protected logError(error: unknown): void {
    this.log(LogColor.Red, `<<${this.name} ERROR>>`, error);
  }

  private getColorCode(color: LogColor): string {
    const colorCodes: Record<LogColor, string> = {
      [LogColor.Red]: "\x1b[31m",
      [LogColor.Green]: "\x1b[32m",
      [LogColor.Yellow]: "\x1b[33m",
      [LogColor.Blue]: "\x1b[34m",
      [LogColor.Magenta]: "\x1b[35m",
      [LogColor.Cyan]: "\x1b[36m",
      [LogColor.White]: "\x1b[37m",
    };
    return colorCodes[color] || "\x1b[0m";
  }
}

enum LogColor {
  Red = "red",
  Green = "green",
  Yellow = "yellow",
  Blue = "blue",
  Magenta = "magenta",
  Cyan = "cyan",
  White = "white",
}
