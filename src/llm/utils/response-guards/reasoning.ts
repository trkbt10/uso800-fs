/**
 * @file Type guards for reasoning-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, asRecord } from "./common";

/**
 * Type guard for ResponseReasoningTextDeltaEvent.
 */
export function isReasoningTextDeltaEvent(ev: unknown): ev is Responses.ResponseReasoningTextDeltaEvent {
  if (!hasTypeProp(ev, "response.reasoning.text.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate)) {return false;}
  if (!isString(candidate.delta)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseReasoningTextDoneEvent.
 */
export function isReasoningTextDoneEvent(ev: unknown): ev is Responses.ResponseReasoningTextDoneEvent {
  if (!hasTypeProp(ev, "response.reasoning.text.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("text" in candidate)) {return false;}
  if (!isString(candidate.text)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseReasoningSummaryPartAddedEvent.
 */
export function isReasoningSummaryPartAddedEvent(ev: unknown): ev is Responses.ResponseReasoningSummaryPartAddedEvent {
  if (!hasTypeProp(ev, "response.reasoning_summary.part.added")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("part" in candidate)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseReasoningSummaryPartDoneEvent.
 */
export function isReasoningSummaryPartDoneEvent(ev: unknown): ev is Responses.ResponseReasoningSummaryPartDoneEvent {
  if (!hasTypeProp(ev, "response.reasoning_summary.part.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("part" in candidate)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseReasoningSummaryTextDeltaEvent.
 */
export function isReasoningSummaryTextDeltaEvent(ev: unknown): ev is Responses.ResponseReasoningSummaryTextDeltaEvent {
  if (!hasTypeProp(ev, "response.reasoning_summary.text.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate)) {return false;}
  if (!isString(candidate.delta)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseReasoningSummaryTextDoneEvent.
 */
export function isReasoningSummaryTextDoneEvent(ev: unknown): ev is Responses.ResponseReasoningSummaryTextDoneEvent {
  if (!hasTypeProp(ev, "response.reasoning_summary.text.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("text" in candidate)) {return false;}
  if (!isString(candidate.text)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}