/**
 * @file Handler for response.function_call_arguments.done events.
 */

import type { Responses } from "openai/resources/responses/responses";
import type { StreamEventHandler, HandlerResult } from "./types";
import { safeParseJsonObject } from "./utils";
import { hasAbort } from "./utils";

/**
 * Handles arguments done events by parsing and executing the function call.
 */
export const handleArgumentsDone: StreamEventHandler<Responses.ResponseFunctionCallArgumentsDoneEvent> = async (
  event,
  context
): Promise<HandlerResult | void> => {
  const current = context.argsByItem.get(event.item_id);
  
  if (!current) {
    // Debug logging
    if (context.options?.logger) {
      await context.options.logger.write({
        type: "debug.arguments_done.no_current",
        ts: new Date().toISOString(),
        sessionId: context.sessionId,
        itemId: event.item_id,
        argsByItemKeys: Array.from(context.argsByItem.keys()),
      });
    }
    return;
  }

  // Prefer explicit arguments on the event; otherwise fall back to accumulated buffer
  const jsonText = typeof event.arguments === "string" ? event.arguments : current.buf;
  const parsed = safeParseJsonObject(jsonText);
  
  if (!parsed) {
    return;
  }

  // Log the function call
  if (context.options?.logger) {
    await context.options.logger.write({
      type: "function_call.arguments.done",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      itemId: event.item_id,
      name: current.name,
      params: parsed,
    });
  }

  // Execute the function call
  const maybe = await context.onFunctionCall({ 
    name: current.name, 
    params: parsed 
  });

  if (typeof maybe !== "undefined") {
    // Check if we should abort after first result
    if (context.options?.endAfterFirst !== false) {
      if (hasAbort(context.stream)) {
        try {
          context.stream.abort();
        } catch {
          // ignore abort errors
        }
      }
      return { 
        shouldBreak: true, 
        result: maybe 
      };
    }
    return { result: maybe };
  }
};
