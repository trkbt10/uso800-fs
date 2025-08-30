/**
 * @file Type guards for content-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isNumber, isObject, asRecord } from "../common";

/**
 * Type guard for ResponseContentPartAddedEvent.
 */
export function isContentPartAddedEvent(ev: unknown): ev is Responses.ResponseContentPartAddedEvent {
  if (!hasTypeProp(ev, "response.content_part.added")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("part" in candidate)) {return false;}
  if (!isObject(candidate.part)) {return false;}
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseContentPartDoneEvent.
 */
export function isContentPartDoneEvent(ev: unknown): ev is Responses.ResponseContentPartDoneEvent {
  if (!hasTypeProp(ev, "response.content_part.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("part" in candidate)) {return false;}
  if (!isObject(candidate.part)) {return false;}
  if (!("content_index" in candidate)) {return false;}
  if (!isNumber(candidate.content_index)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}