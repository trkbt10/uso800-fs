/**
 * @file Handler for response.output_item.added events.
 */

import type { Responses } from "openai/resources/responses/responses";
import type { StreamEventHandler } from "./types";
import { extractOutputItem, isFunctionCallItem } from "../response-guards/function-call";

/**
 * Handles output item added events by registering new function call items.
 */
export const handleOutputItemAdded: StreamEventHandler<Responses.ResponseOutputItemAddedEvent> = (
  event,
  context
) => {
  const itemData = extractOutputItem(event.item);
  
  if (isFunctionCallItem(event.item) && itemData.id) {
    context.argsByItem.set(itemData.id, { 
      name: itemData.name, 
      buf: "" 
    });
  }
};