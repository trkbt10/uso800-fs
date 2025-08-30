/**
 * @file Type guards for MCP (Model Context Protocol) related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isObject, asRecord } from "./common";

/**
 * Type guard for ResponseMcpCallArgumentsDeltaEvent.
 */
export function isMcpCallArgumentsDeltaEvent(ev: unknown): ev is Responses.ResponseMcpCallArgumentsDeltaEvent {
  if (!hasTypeProp(ev, "response.mcp_call.arguments.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate) || !isString(candidate.delta)) {
    return false;
  }
  if (!("item_id" in candidate) || !isString(candidate.item_id)) {
    return false;
  }
  // call_id may be omitted in some minimal streams; accept when present
  if ("call_id" in candidate && !isString(candidate.call_id)) {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  if (typeof (candidate as any).output_index !== "number") {
    return false;
  }
  if (!("sequence_number" in candidate)) {
    return false;
  }
  return typeof (candidate as any).sequence_number === "number";
}

/**
 * Type guard for ResponseMcpCallArgumentsDoneEvent.
 */
export function isMcpCallArgumentsDoneEvent(ev: unknown): ev is Responses.ResponseMcpCallArgumentsDoneEvent {
  if (!hasTypeProp(ev, "response.mcp_call.arguments.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("arguments" in candidate)) {
    return false;
  }
  if (!isString(candidate.arguments)) {
    return false;
  }
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("call_id" in candidate)) {
    return false;
  }
  return isString(candidate.call_id);
}

/**
 * Type guard for ResponseMcpCallCompletedEvent.
 */
export function isMcpCallCompletedEvent(ev: unknown): ev is Responses.ResponseMcpCallCompletedEvent {
  if (!hasTypeProp(ev, "response.mcp_call.completed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("call_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.call_id)) {
    return false;
  }
  if (!("result" in candidate)) {
    return false;
  }
  return isObject(candidate.result);
}

/**
 * Type guard for ResponseMcpCallFailedEvent.
 */
export function isMcpCallFailedEvent(ev: unknown): ev is Responses.ResponseMcpCallFailedEvent {
  if (!hasTypeProp(ev, "response.mcp_call.failed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("call_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.call_id)) {
    return false;
  }
  if (!("error" in candidate)) {
    return false;
  }
  return isObject(candidate.error);
}

/**
 * Type guard for ResponseMcpCallInProgressEvent.
 */
export function isMcpCallInProgressEvent(ev: unknown): ev is Responses.ResponseMcpCallInProgressEvent {
  if (!hasTypeProp(ev, "response.mcp_call.in_progress")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("call_id" in candidate)) {
    return false;
  }
  return isString(candidate.call_id);
}

/**
 * Type guard for ResponseMcpListToolsCompletedEvent.
 */
export function isMcpListToolsCompletedEvent(ev: unknown): ev is Responses.ResponseMcpListToolsCompletedEvent {
  if (!hasTypeProp(ev, "response.mcp_list_tools.completed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("tools" in candidate)) {
    return false;
  }
  return Array.isArray(candidate.tools);
}

/**
 * Type guard for ResponseMcpListToolsFailedEvent.
 */
export function isMcpListToolsFailedEvent(ev: unknown): ev is Responses.ResponseMcpListToolsFailedEvent {
  if (!hasTypeProp(ev, "response.mcp_list_tools.failed")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("error" in candidate)) {
    return false;
  }
  return isObject(candidate.error);
}

/**
 * Type guard for ResponseMcpListToolsInProgressEvent.
 */
export function isMcpListToolsInProgressEvent(ev: unknown): ev is Responses.ResponseMcpListToolsInProgressEvent {
  if (!hasTypeProp(ev, "response.mcp_list_tools.in_progress")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  return isString(candidate.item_id);
}
