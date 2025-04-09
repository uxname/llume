import type { ExecutionEvent } from "./execution-event";

export interface EventHandler {
	publish(event: ExecutionEvent): Promise<void> | void;
}
