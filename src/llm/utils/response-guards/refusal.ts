/**
 * @file Type guards for refusal-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, asRecord } from "../common";

/**
 * Type guard for ResponseRefusalDeltaEvent.
 */
export function isRefusalDeltaEvent(ev: unknown): ev is Responses.ResponseRefusalDeltaEvent {
  if (!hasTypeProp(ev, "response.refusal.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate)) {return false;}
  if (!isString(candidate.delta)) {return false;}
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseRefusalDoneEvent.
 */
export function isRefusalDoneEvent(ev: unknown): ev is Responses.ResponseRefusalDoneEvent {
  if (!hasTypeProp(ev, "response.refusal.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("refusal" in candidate)) {return false;}
  if (!isString(candidate.refusal)) {return false;}
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}