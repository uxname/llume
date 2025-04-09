import type { ExecutionEvent } from "./execution-event";

/** Interface for handling execution events for tracing, logging, or monitoring. */
export interface EventHandler {
	/**
	 * Publishes an execution event.
	 * This method can be synchronous or asynchronous.
	 * @param event The execution event to handle.
	 */
	publish(event: ExecutionEvent): Promise<void> | void;
}
