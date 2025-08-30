/**
 * @file Type guards for web search-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, asRecord } from "./common";

/**
 * Type guard for ResponseWebSearchCallCompletedEvent.
 */
export function isWebSearchCompletedEvent(ev: unknown): ev is Responses.ResponseWebSearchCallCompletedEvent {
  if (!hasTypeProp(ev, "response.web_search.completed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  if (!isString(candidate.call_id)) {return false;}
  if (!("results" in candidate)) {return false;}
  return Array.isArray(candidate.results);
}

/**
 * Type guard for ResponseWebSearchCallInProgressEvent.
 */
export function isWebSearchInProgressEvent(ev: unknown): ev is Responses.ResponseWebSearchCallInProgressEvent {
  if (!hasTypeProp(ev, "response.web_search.in_progress")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  return isString(candidate.call_id);
}

/**
 * Type guard for ResponseWebSearchCallSearchingEvent.
 */
export function isWebSearchSearchingEvent(ev: unknown): ev is Responses.ResponseWebSearchCallSearchingEvent {
  if (!hasTypeProp(ev, "response.web_search.searching")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  return isString(candidate.call_id);
}