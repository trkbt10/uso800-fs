/**
 * @file Handler for response.output_item.added events.
 */

import type { Responses } from "openai/resources/responses/responses";
import type { StreamEventHandler } from "./types";
import { extractOutputItem, isFunctionCallItem } from "../response-guards/function-call";

/**
 * Handles output item added events by registering new function call items.
 */
export const handleOutputItemAdded: StreamEventHandler<Responses.ResponseOutputItemAddedEvent> = async (
  event,
  context
) => {
  const itemData = extractOutputItem(event.item);
  const isFunctionCall = isFunctionCallItem(event.item);
  
  // Debug logging
  if (context.options?.logger) {
    await context.options.logger.write({
      type: "debug.output_item_added",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      itemData,
      isFunctionCall,
      eventItem: event.item,
      itemType: event.item?.type,
      hasId: !!itemData.id,
    });
  }
  
  if (isFunctionCall && itemData.id) {
    context.argsByItem.set(itemData.id, { 
      name: itemData.name, 
      buf: "" 
    });
    
    // Debug logging after setting
    if (context.options?.logger) {
      await context.options.logger.write({
        type: "debug.output_item_added.set",
        ts: new Date().toISOString(),
        sessionId: context.sessionId,
        itemId: itemData.id,
        name: itemData.name,
        argsByItemKeys: Array.from(context.argsByItem.keys()),
      });
    }
  }
};