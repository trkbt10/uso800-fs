/**
 * @file Type guards for OpenAI Responses API stream events with proper type checking.
 */
import type { Responses } from "openai/resources/responses/responses";

/**
 * Type guard to check if an object has a specific property with a specific value.
 */
function hasTypeProp<T extends string>(obj: unknown, type: T): obj is { type: T } {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  if (!("type" in obj)) {
    return false;
  }
  const t = (obj as Record<string, unknown>).type;
  return t === type;
}

/**
 * Check if event is a valid ResponseStreamEvent.
 */
export function isResponseStreamEvent(ev: unknown): ev is Responses.ResponseStreamEvent {
  if (typeof ev !== "object" || ev === null) {
    return false;
  }
  if (!("type" in ev)) {
    return false;
  }
  const t = (ev as Record<string, unknown>).type;
  return typeof t === "string";
}

/**
 * True when event contains an added output item.
 */
export function isOutputItemAddedEvent(ev: unknown): ev is Responses.ResponseOutputItemAddedEvent {
  if (!hasTypeProp(ev, "response.output_item.added")) {
    return false;
  }
  const candidate = ev as Record<string, unknown>;
  if (!("item" in candidate)) {return false;}
  return typeof candidate.item === "object" && candidate.item !== null;
}

/**
 * True when event contains an arguments delta chunk.
 */
export function isArgsDeltaEvent(ev: unknown): ev is Responses.ResponseFunctionCallArgumentsDeltaEvent {
  if (!hasTypeProp(ev, "response.function_call_arguments.delta")) {
    return false;
  }
  const candidate = ev as Record<string, unknown>;
  if (!("delta" in candidate)) {return false;}
  if (typeof candidate.delta !== "string") {return false;}
  if (!("item_id" in candidate)) {return false;}
  return typeof candidate.item_id === "string";
}

/**
 * True when event indicates the end of function_call arguments.
 */
export function isArgsDoneEvent(ev: unknown): ev is Responses.ResponseFunctionCallArgumentsDoneEvent {
  if (!hasTypeProp(ev, "response.function_call_arguments.done")) {
    return false;
  }
  const candidate = ev as Record<string, unknown>;
  if (!("item_id" in candidate)) {
    return false;
  }
  return typeof candidate.item_id === "string";
}

/**
 * True when event indicates an output item is done.
 */
export function isOutputItemDoneEvent(ev: unknown): ev is Responses.ResponseOutputItemDoneEvent {
  if (!hasTypeProp(ev, "response.output_item.done")) {
    return false;
  }
  const candidate = ev as Record<string, unknown>;
  if (!("item" in candidate)) {
    return false;
  }
  if (typeof candidate.item !== "object" || candidate.item === null) {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  if (typeof candidate.output_index !== "number") {
    return false;
  }
  if (!("sequence_number" in candidate)) {
    return false;
  }
  return typeof candidate.sequence_number === "number";
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
  } else if ("name" in item) {
    // Some other types might have name - use unknown first to be safe
    const itemAsUnknown = item as unknown;
    const itemWithName = itemAsUnknown as Record<string, unknown>;
    if (typeof itemWithName.name === "string") {
      out.name = itemWithName.name;
    }
  }

  return out;
}

/**
 * Check if a ResponseOutputItem is a function call.
 */
export function isFunctionCallItem(item: Responses.ResponseOutputItem): item is Responses.ResponseFunctionToolCall {
  return item.type === "function_call";
}

/**
 * Type guard for text delta events.
 */
export function isTextDeltaEvent(ev: unknown): ev is Responses.ResponseTextDeltaEvent {
  if (!hasTypeProp(ev, "response.output_text.delta")) {
    return false;
  }
  const candidate = ev as Record<string, unknown>;
  if (!("content_index" in candidate)) {
    return false;
  }
  if (typeof candidate.content_index !== "number") {
    return false;
  }
  if (!("delta" in candidate)) {
    return false;
  }
  if (typeof candidate.delta !== "string") {
    return false;
  }
  if (!("item_id" in candidate)) {
    return false;
  }
  if (typeof candidate.item_id !== "string") {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  return typeof candidate.output_index === "number";
}

/**
 * Type guard for text done events.
 */
export function isTextDoneEvent(ev: unknown): ev is Responses.ResponseTextDoneEvent {
  if (!hasTypeProp(ev, "response.output_text.done")) {
    return false;
  }
  const candidate = ev as Record<string, unknown>;
  if (!("content_index" in candidate)) {
    return false;
  }
  if (typeof candidate.content_index !== "number") {
    return false;
  }
  if (!("item_id" in candidate)) {
    return false;
  }
  if (typeof candidate.item_id !== "string") {
    return false;
  }
  if (!("text" in candidate)) {
    return false;
  }
  if (typeof candidate.text !== "string") {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  return typeof candidate.output_index === "number";
}
