/**
 * @file Minimal JSON streaming accumulator for OpenAI Responses API.
 * Collects output_text.{delta,done} events and returns parsed JSON object.
 */
import type { Responses } from "openai/resources/responses/responses";
import { isTextDeltaEvent, isTextDoneEvent } from "./response-guards";
import { safeParseJsonObject } from "./stream-handlers/utils";

/**
 * Accumulate streamed text events into a single JSON object.
 * Returns undefined when no valid JSON object can be parsed.
 */
export async function runJsonStreaming(
  stream: AsyncIterable<Responses.ResponseStreamEvent | unknown>,
): Promise<Record<string, unknown> | undefined> {
  const acc = { text: "" };
  for await (const ev of stream) {
    if (isTextDeltaEvent(ev)) {
      acc.text = acc.text + (ev.delta ?? "");
      continue;
    }
    if (isTextDoneEvent(ev)) {
      // Prefer the final text if present; otherwise use buffer
      const text = typeof ev.text === "string" && ev.text.length > 0 ? ev.text : acc.text;
      return safeParseJsonObject(text);
    }
  }
  // Fallback: try parsing whatever was accumulated
  if (acc.text.length > 0) {
    return safeParseJsonObject(acc.text);
  }
  return undefined;
}
