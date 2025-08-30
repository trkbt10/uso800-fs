/**
 * @file Type guards for audio-related response events.
 */
import type { Responses } from "openai/resources/responses/responses";
import { hasTypeProp, isString, isNumber, asRecord } from "../common";

/**
 * Type guard for ResponseAudioDeltaEvent.
 */
export function isAudioDeltaEvent(ev: unknown): ev is Responses.ResponseAudioDeltaEvent {
  if (!hasTypeProp(ev, "response.audio.delta")) {
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
  if (!("output_index" in candidate)) {
    return false;
  }
  if (!isNumber(candidate.output_index)) {
    return false;
  }
  if (!("content_index" in candidate)) {
    return false;
  }
  return isNumber(candidate.content_index);
}

/**
 * Type guard for ResponseAudioDoneEvent.
 */
export function isAudioDoneEvent(ev: unknown): ev is Responses.ResponseAudioDoneEvent {
  if (!hasTypeProp(ev, "response.audio.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  if (!isNumber(candidate.output_index)) {
    return false;
  }
  if (!("content_index" in candidate)) {
    return false;
  }
  return isNumber(candidate.content_index);
}

/**
 * Type guard for ResponseAudioTranscriptDeltaEvent.
 */
export function isAudioTranscriptDeltaEvent(ev: unknown): ev is Responses.ResponseAudioTranscriptDeltaEvent {
  if (!hasTypeProp(ev, "response.audio_transcript.delta")) {
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
  if (!("output_index" in candidate)) {
    return false;
  }
  if (!isNumber(candidate.output_index)) {
    return false;
  }
  if (!("content_index" in candidate)) {
    return false;
  }
  return isNumber(candidate.content_index);
}

/**
 * Type guard for ResponseAudioTranscriptDoneEvent.
 */
export function isAudioTranscriptDoneEvent(ev: unknown): ev is Responses.ResponseAudioTranscriptDoneEvent {
  if (!hasTypeProp(ev, "response.audio_transcript.done")) {
    return false;
  }
  const candidate = asRecord(ev);
  if (!("transcript" in candidate)) {
    return false;
  }
  if (!isString(candidate.transcript)) {
    return false;
  }
  if (!("item_id" in candidate)) {
    return false;
  }
  if (!isString(candidate.item_id)) {
    return false;
  }
  if (!("output_index" in candidate)) {
    return false;
  }
  if (!isNumber(candidate.output_index)) {
    return false;
  }
  if (!("content_index" in candidate)) {
    return false;
  }
  return isNumber(candidate.content_index);
}
