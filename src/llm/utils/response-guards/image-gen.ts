/**
 * @file Type guards for image generation-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, asRecord } from "./common";

/**
 * Type guard for ResponseImageGenCallCompletedEvent.
 */
export function isImageGenCompletedEvent(ev: unknown): ev is Responses.ResponseImageGenCallCompletedEvent {
  if (!hasTypeProp(ev, "response.image_gen.completed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  if (!isString(candidate.call_id)) {return false;}
  if (!("image" in candidate)) {return false;}
  return isString(candidate.image);
}

/**
 * Type guard for ResponseImageGenCallGeneratingEvent.
 */
export function isImageGenGeneratingEvent(ev: unknown): ev is Responses.ResponseImageGenCallGeneratingEvent {
  if (!hasTypeProp(ev, "response.image_gen.generating")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  return isString(candidate.call_id);
}

/**
 * Type guard for ResponseImageGenCallInProgressEvent.
 */
export function isImageGenInProgressEvent(ev: unknown): ev is Responses.ResponseImageGenCallInProgressEvent {
  if (!hasTypeProp(ev, "response.image_gen.in_progress")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  return isString(candidate.call_id);
}

/**
 * Type guard for ResponseImageGenCallPartialImageEvent.
 */
export function isImageGenPartialImageEvent(ev: unknown): ev is Responses.ResponseImageGenCallPartialImageEvent {
  if (!hasTypeProp(ev, "response.image_gen.partial_image")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  if (!isString(candidate.call_id)) {return false;}
  if (!("image" in candidate)) {return false;}
  return isString(candidate.image);
}