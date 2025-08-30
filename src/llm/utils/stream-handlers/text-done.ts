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