/**
 * @file Type guards for file search-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, asRecord } from "../common";

/**
 * Type guard for ResponseFileSearchCallCompletedEvent.
 */
export function isFileSearchCompletedEvent(ev: unknown): ev is Responses.ResponseFileSearchCallCompletedEvent {
  if (!hasTypeProp(ev, "response.file_search.completed")) {
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
 * Type guard for ResponseFileSearchCallInProgressEvent.
 */
export function isFileSearchInProgressEvent(ev: unknown): ev is Responses.ResponseFileSearchCallInProgressEvent {
  if (!hasTypeProp(ev, "response.file_search.in_progress")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  return isString(candidate.call_id);
}

/**
 * Type guard for ResponseFileSearchCallSearchingEvent.
 */
export function isFileSearchSearchingEvent(ev: unknown): ev is Responses.ResponseFileSearchCallSearchingEvent {
  if (!hasTypeProp(ev, "response.file_search.searching")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  return isString(candidate.call_id);
}