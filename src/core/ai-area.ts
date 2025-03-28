import type {
  AiStatelessFunction,
  Variables,
} from "./base-classes/ai-stateless-function.ts";
import { History } from "./base-classes/history.ts";
import { State } from "./base-classes/state.ts";
import { AiStatefulFunction } from "./base-classes/ai-stateful-function.ts";

export class AiArea {
  private functions: Map<string, AiStatefulFunction> = new Map();
  llmHistory = new History();

  addFunction(aiStatelessFunction: AiStatelessFunction): void {
    const state = new State();
    const executableAiFunction = new AiStatefulFunction(
      aiStatelessFunction,
      this,
      state,
    );
    this.functions.set(aiStatelessFunction.name, executableAiFunction);
  }

  async executeFunction<TInput extends Variables, TOutput extends Variables>(
    name: string,
    input: TInput,
  ): Promise<TOutput> {
    const aiFunction = this.functions.get(name);
    if (!aiFunction) {
      throw new Error(`Function ${name} not found`);
    }

    console.log(`Executing function ${name}, input:`, input);

    return input as unknown as TOutput;
  }
}
