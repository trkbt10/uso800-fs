/**
 * @file Handler for response.function_call.output_text.done events.
 */

import type { StreamEventHandler } from "./types";

/**
 * Custom text done event type (not in standard OpenAI types).
 */
export type TextDoneEvent = {
  type: string;
  item_id?: string;
}

/**
 * Handles text done events for function output.
 */
/**
 * Signals completion of function output text and optionally logs it.
 */
export const handleTextDone: StreamEventHandler<TextDoneEvent> = async (
  event,
  context
) => {
  const itemId = event.item_id;
  
  if (!itemId || typeof itemId !== "string") {
    return;
  }

  const current = context.argsByItem.get(itemId);
  
  // Call the text done handler if provided
  if (context.options?.onFunctionOutputTextDone) {
    await context.options.onFunctionOutputTextDone({ 
      itemId, 
      name: current?.name 
    });
  }

  // Log the event
  if (context.options?.logger) {
    await context.options.logger.write({
      type: "function_call.output_text.done",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      itemId,
      name: current?.name,
    });
  }
};

/**
 * Back-compat alias for unit specs: resets a simple `{ accumulated }` object.
 */
export function handleTextDoneEvent(
  event: { text?: string },
  acc: { accumulated: string },
): string {
  const text = typeof event.text === "string" ? event.text : "";
  acc.accumulated = "";
  return text;
}
