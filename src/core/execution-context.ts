import { ExecutionContextStore } from "./execution-context-store.ts";
import type { Variables } from "./base-classes/stateless-function.ts";

export class ExecutionContext extends ExecutionContextStore {
  async executeSingleFunction<
    TInput extends Variables,
    TOutput extends Variables,
  >(functionName: string, input: TInput): Promise<TOutput> {
    const aiFunction = this.functions.get(functionName);
    if (!aiFunction) {
      throw new Error(`Function ${functionName} not found`);
    }

    console.log(`Executing function ${functionName}, input:`, input);

    return {
      result: {
        number: 123,
        string: "hello",
      },
    } as unknown as TOutput;
  }
}
