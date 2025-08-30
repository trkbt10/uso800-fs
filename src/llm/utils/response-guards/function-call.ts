/**
 * @file Type guards for function call-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, asRecord } from "./common";

/**
 * Type guard for ResponseFunctionCallArgumentsDeltaEvent.
 */
export function isArgsDeltaEvent(ev: unknown): ev is Responses.ResponseFunctionCallArgumentsDeltaEvent {
  if (!hasTypeProp(ev, "response.function_call_arguments.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate)) {return false;}
  if (!isString(candidate.delta)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  if (!isNumber(candidate.output_index)) {return false;}
  if (!("sequence_number" in candidate)) {return false;}
  return isNumber(candidate.sequence_number);
}

/**
 * Type guard for ResponseFunctionCallArgumentsDoneEvent.
 */
export function isArgsDoneEvent(ev: unknown): ev is Responses.ResponseFunctionCallArgumentsDoneEvent {
  if (!hasTypeProp(ev, "response.function_call_arguments.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("arguments" in candidate)) {return false;}
  if (!isString(candidate.arguments)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  if (!isNumber(candidate.output_index)) {return false;}
  if (!("sequence_number" in candidate)) {return false;}
  return isNumber(candidate.sequence_number);
}

/**
 * Check if a ResponseOutputItem is a function call.
 */
export function isFunctionCallItem(item: Responses.ResponseOutputItem): item is Responses.ResponseFunctionToolCall {
  return item.type === "function_call";
}

/**
 * Helper to check if an item has a name property.
 */
function hasNameProperty(item: unknown): item is { name: string } {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return "name" in obj ? typeof obj.name === "string" : false;
}

/**
 * Extract item from ResponseOutputItem, handling union type.
 * Since ResponseOutputItem is a discriminated union, we use type narrowing.
 */
export function extractOutputItem(item: Responses.ResponseOutputItem): {
  id?: string;
  type?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
} {
  const out: { id?: string; type?: string; name?: string; arguments?: string; call_id?: string } = {};

  // All items have these common properties
  if ("id" in item) {
    out.id = item.id;
  }
  if ("type" in item) {
    out.type = item.type;
  }

  // Type-specific properties using discriminated union
  if (item.type === "function_call") {
    const funcItem = item as Responses.ResponseFunctionToolCall;
    out.name = funcItem.name;
    out.arguments = funcItem.arguments;
    out.call_id = funcItem.call_id;
  } else if (hasNameProperty(item)) {
    // Some other types might have name
    out.name = item.name;
  }

  return out;
}