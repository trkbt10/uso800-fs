/**
 * @file Type guards for code interpreter-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, asRecord } from "../common";

/**
 * Type guard for ResponseCodeInterpreterCallCodeDeltaEvent.
 */
export function isCodeInterpreterCodeDeltaEvent(
  ev: unknown,
): ev is Responses.ResponseCodeInterpreterCallCodeDeltaEvent {
  if (!hasTypeProp(ev, "response.code_interpreter.code.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate)) {
    return false;
  }
  if (!isString(candidate.delta)) {
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
 * Type guard for ResponseCodeInterpreterCallCodeDoneEvent.
 */
export function isCodeInterpreterCodeDoneEvent(ev: unknown): ev is Responses.ResponseCodeInterpreterCallCodeDoneEvent {
  if (!hasTypeProp(ev, "response.code_interpreter.code.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("input" in candidate)) {
    return false;
  }
  if (!isString(candidate.input)) {
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
 * Type guard for ResponseCodeInterpreterCallCompletedEvent.
 */
export function isCodeInterpreterCompletedEvent(
  ev: unknown,
): ev is Responses.ResponseCodeInterpreterCallCompletedEvent {
  if (!hasTypeProp(ev, "response.code_interpreter.completed")) {
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
  if (!("outputs" in candidate)) {
    return false;
  }
  return Array.isArray(candidate.outputs);
}

/**
 * Type guard for ResponseCodeInterpreterCallInProgressEvent.
 */
export function isCodeInterpreterInProgressEvent(
  ev: unknown,
): ev is Responses.ResponseCodeInterpreterCallInProgressEvent {
  if (!hasTypeProp(ev, "response.code_interpreter.in_progress")) {
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
 * Type guard for ResponseCodeInterpreterCallInterpretingEvent.
 */
export function isCodeInterpreterInterpretingEvent(
  ev: unknown,
): ev is Responses.ResponseCodeInterpreterCallInterpretingEvent {
  if (!hasTypeProp(ev, "response.code_interpreter.interpreting")) {
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
