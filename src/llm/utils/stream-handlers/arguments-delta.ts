/**
 * @file Handler for response.function_call_arguments.delta events.
 */

import type { Responses } from "openai/resources/responses/responses";
import type { StreamEventHandler } from "./types";

/**
 * Handles arguments delta events by appending to the buffer.
 */
export const handleArgumentsDelta: StreamEventHandler<Responses.ResponseFunctionCallArgumentsDeltaEvent> = (
  event,
  context
) => {
  const current = context.argsByItem.get(event.item_id);
  
  if (current) {
    current.buf += event.delta;
  }
};