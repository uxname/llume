export class LlmHelper {
  /**
   * Extracts JSON string from LLM response by removing surrounding text and code block markers.
   *
   * Extraction strategies (in priority order):
   * 1. Look for ```json ... ``` block
   * 2. Check generic ```...``` blocks containing JSON-like content
   * 3. Find JSON boundaries using first/last braces/brackets
   *
   * @param response LLM response string
   * @returns Extracted JSON string (not guaranteed to be valid) or empty string
   */
  static sanitizeLLMJsonResponse(response: string): string {
    if (!response.trim()) return "";

    const strategies: Array<() => string | null> = [
      () => this.extractJsonBlock(response),
      () => this.extractGenericCodeBlock(response),
      () => this.extractByBraceBounds(response),
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) return result;
    }

    return "";
  }

  private static extractJsonBlock(response: string): string | null {
    const match = response.match(/```(?:json|JSON)\s*([\s\S]*?)\s*```/);
    return match?.[1]?.trim() || null;
  }

  private static extractGenericCodeBlock(response: string): string | null {
    const match = response.match(/```\s*([\s\S]*?)\s*```/);
    if (!match) return null;

    const content = match[1].trim();
    return content.startsWith("{") || content.startsWith("[") ? content : null;
  }

  private static extractByBraceBounds(response: string): string | null {
    const starts = this.findStartIndices(response);
    if (!starts.length) return null;

    const startIndex = Math.min(...starts);
    const startChar = response[startIndex];
    const expectedCloseChar = startChar === "{" ? "}" : "]";

    let balance = 1;
    let currentIndex = startIndex + 1;

    while (currentIndex < response.length && balance > 0) {
      const currentChar = response[currentIndex];
      if (currentChar === startChar) {
        balance++;
      } else if (currentChar === expectedCloseChar) {
        balance--;
      }
      currentIndex++;
    }

    return balance === 0
      ? response.substring(startIndex, currentIndex).trim()
      : null;
  }

  private static findStartIndices(text: string): number[] {
    return [text.indexOf("{"), text.indexOf("[")].filter((idx) => idx !== -1);
  }

  private static findEndIndices(text: string): number[] {
    return [text.lastIndexOf("}"), text.lastIndexOf("]")].filter(
      (idx) => idx !== -1,
    );
  }
}
