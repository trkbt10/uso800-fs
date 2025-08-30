/**
 * @file Handler for response.output_item.done events.
 */

import type { Responses } from "openai/resources/responses/responses";
import type { StreamEventHandler, HandlerResult } from "./types";
import { extractOutputItem, isFunctionCallItem } from "../response-guards/function-call";
import { safeParseJsonObject, hasAbort } from "./utils";

/**
 * Handles output item done events by processing completed function calls.
 */
export const handleOutputItemDone: StreamEventHandler<Responses.ResponseOutputItemDoneEvent> = async (
  event,
  context
): Promise<HandlerResult | void> => {
  const itemData = extractOutputItem(event.item);
  
  if (!isFunctionCallItem(event.item) || !itemData.id) {
    return;
  }

  const current = context.argsByItem.get(itemData.id);
  
  if (!current) {
    return;
  }

  // Update name if not already set
  if (!current.name && itemData.name) {
    current.name = itemData.name;
  }

  // If arguments are provided directly in the item
  if (!itemData.arguments) {
    return;
  }

  const parsed = safeParseJsonObject(itemData.arguments);
  
  if (!parsed) {
    return;
  }

  // Log the function call
  if (context.options?.logger) {
    await context.options.logger.write({
      type: "function_call.output_item.done",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      itemId: itemData.id,
      name: current.name ?? itemData.name,
      params: parsed,
    });
  }

  // Execute the function call
  const maybe = await context.onFunctionCall({ 
    name: current.name ?? itemData.name, 
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