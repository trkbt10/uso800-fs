/**
 * @file Type guards for core response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, isObject, asRecord } from "../common";

/**
 * Check if event is a valid ResponseStreamEvent.
 */
export function isResponseStreamEvent(ev: unknown): ev is Responses.ResponseStreamEvent {
  if (!isObject(ev)) {
    return false;
  }
  if (!("type" in ev)) {
    return false;
  }
  const t = asRecord(ev).type;
  return isString(t);
}

/**
 * Type guard for ResponseCreatedEvent.
 */
export function isResponseCreatedEvent(ev: unknown): ev is Responses.ResponseCreatedEvent {
  if (!hasTypeProp(ev, "response.created")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("response" in candidate)) {
    return false;
  }
  return isObject(candidate.response);
}

/**
 * Type guard for ResponseCompletedEvent.
 */
export function isResponseCompletedEvent(ev: unknown): ev is Responses.ResponseCompletedEvent {
  if (!hasTypeProp(ev, "response.completed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("response" in candidate)) {
    return false;
  }
  return isObject(candidate.response);
}

/**
 * Type guard for ResponseInProgressEvent.
 */
export function isResponseInProgressEvent(ev: unknown): ev is Responses.ResponseInProgressEvent {
  if (!hasTypeProp(ev, "response.in_progress")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("response" in candidate)) {
    return false;
  }
  return isObject(candidate.response);
}

/**
 * Type guard for ResponseFailedEvent.
 */
export function isResponseFailedEvent(ev: unknown): ev is Responses.ResponseFailedEvent {
  if (!hasTypeProp(ev, "response.failed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("response" in candidate)) {
    return false;
  }
  return isObject(candidate.response);
}

/**
 * Type guard for ResponseIncompleteEvent.
 */
export function isResponseIncompleteEvent(ev: unknown): ev is Responses.ResponseIncompleteEvent {
  if (!hasTypeProp(ev, "response.incomplete")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("response" in candidate)) {
    return false;
  }
  return isObject(candidate.response);
}

/**
 * Type guard for ResponseErrorEvent.
 */
export function isResponseErrorEvent(ev: unknown): ev is Responses.ResponseErrorEvent {
  if (!hasTypeProp(ev, "response.error")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("error" in candidate)) {
    return false;
  }
  return isObject(candidate.error);
}

/**
 * Type guard for ResponseQueuedEvent.
 */
export function isResponseQueuedEvent(ev: unknown): ev is Responses.ResponseQueuedEvent {
  if (!hasTypeProp(ev, "response.queued")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("response" in candidate)) {
    return false;
  }
  return isObject(candidate.response);
}

/**
 * Type guard for ResponseOutputItemAddedEvent.
 */
export function isOutputItemAddedEvent(ev: unknown): ev is Responses.ResponseOutputItemAddedEvent {
  if (!hasTypeProp(ev, "response.output_item.added")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item" in candidate)) {
    return false;
  }
  if (!isObject(candidate.item)) {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  if (!isNumber(candidate.output_index)) {
    return false;
  }
  if (!("sequence_number" in candidate)) {
    return false;
  }
  return isNumber(candidate.sequence_number);
}

/**
 * Type guard for ResponseOutputItemDoneEvent.
 */
export function isOutputItemDoneEvent(ev: unknown): ev is Responses.ResponseOutputItemDoneEvent {
  if (!hasTypeProp(ev, "response.output_item.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item" in candidate)) {
    return false;
  }
  if (!isObject(candidate.item)) {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  if (!isNumber(candidate.output_index)) {
    return false;
  }
  if (!("sequence_number" in candidate)) {
    return false;
  }
  return isNumber(candidate.sequence_number);
}
