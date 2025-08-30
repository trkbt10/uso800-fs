/**
 * @file Handler for response.function_call.output_text.delta events.
 */

import type { StreamEventHandler } from "./types";

/**
 * Custom text delta event type (not in standard OpenAI types).
 */
export type TextDeltaEvent = {
  type: string;
  item_id?: string;
  delta?: string;
}

/**
 * Handles text delta events for function output.
 */
export const handleTextDelta: StreamEventHandler<TextDeltaEvent> = async (
  event,
  context
) => {
  const itemId = event.item_id;
  const delta = event.delta;
  
  if (!itemId || typeof delta !== "string") {
    return;
  }

  const current = context.argsByItem.get(itemId);
  
  // Call the text delta handler if provided
  if (context.options?.onFunctionOutputTextDelta) {
    await context.options.onFunctionOutputTextDelta({ 
      itemId, 
      name: current?.name, 
      delta 
    });
  }

  // Log the event
  if (context.options?.logger) {
    await context.options.logger.write({
      type: "function_call.output_text.delta",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      itemId,
      name: current?.name,
      delta,
    });
  }
};