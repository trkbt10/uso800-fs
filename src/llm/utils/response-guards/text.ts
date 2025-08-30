/**
 * @file Type guards for text-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, asRecord } from "./common";

/**
 * Type guard for ResponseTextDeltaEvent.
 */
export function isTextDeltaEvent(ev: unknown): ev is Responses.ResponseTextDeltaEvent {
  if (!hasTypeProp(ev, "response.output_text.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("delta" in candidate)) {return false;}
  if (!isString(candidate.delta)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseTextDoneEvent.
 */
export function isTextDoneEvent(ev: unknown): ev is Responses.ResponseTextDoneEvent {
  if (!hasTypeProp(ev, "response.output_text.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("text" in candidate)) {return false;}
  if (!isString(candidate.text)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseOutputTextAnnotationAddedEvent.
 */
export function isOutputTextAnnotationAddedEvent(ev: unknown): ev is Responses.ResponseOutputTextAnnotationAddedEvent {
  if (!hasTypeProp(ev, "response.output_text.annotation.added")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("annotation" in candidate)) {return false;}
  if (!("annotation_index" in candidate)) {return false;}
  if (!isNumber(candidate.annotation_index)) {return false;}
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}