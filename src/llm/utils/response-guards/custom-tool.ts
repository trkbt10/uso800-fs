/**
 * @file Type guards for custom tool call-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, asRecord } from "../common";

/**
 * Type guard for ResponseCustomToolCallInputDeltaEvent.
 */
export function isCustomToolCallInputDeltaEvent(ev: unknown): ev is Responses.ResponseCustomToolCallInputDeltaEvent {
  if (!hasTypeProp(ev, "response.custom_tool_call.input.delta")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("delta" in candidate)) {return false;}
  if (!isString(candidate.delta)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  if (!isString(candidate.call_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}

/**
 * Type guard for ResponseCustomToolCallInputDoneEvent.
 */
export function isCustomToolCallInputDoneEvent(ev: unknown): ev is Responses.ResponseCustomToolCallInputDoneEvent {
  if (!hasTypeProp(ev, "response.custom_tool_call.input.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("input" in candidate)) {return false;}
  if (!isString(candidate.input)) {return false;}
  if (!("item_id" in candidate)) {return false;}
  if (!isString(candidate.item_id)) {return false;}
  if (!("call_id" in candidate)) {return false;}
  if (!isString(candidate.call_id)) {return false;}
  if (!("output_index" in candidate)) {return false;}
  return isNumber(candidate.output_index);
}