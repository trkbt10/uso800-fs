/**
 * @file Common streaming runner for OpenAI Responses API function_call events.
 */

import {
  isArgsDeltaEvent,
  isArgsDoneEvent,
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
  isResponseStreamEvent,
  isTextDeltaEvent,
  isTextDoneEvent,
} from "./response-stream-guards";

import {
  handleOutputItemAdded,
  handleArgumentsDelta,
  handleArgumentsDone,
  handleOutputItemDone,
  handleTextDelta,
  handleTextDone,
} from "./stream-handlers";

import type { StreamHandlerContext, StreamHandlerOptions, FunctionCallHandler } from "./stream-handlers";

import type { Responses } from "openai/resources/responses/responses";

export type { FunctionCallHandler, StreamHandlerOptions } from "./stream-handlers";
export type StreamEvent = Responses.ResponseStreamEvent;

/**
 * Consumes a Responses API stream and invokes `onFunctionCall` when a function_call's
 * arguments finish streaming. If `endAfterFirst` is not false, attempts to abort the
 * stream after the first handled call to avoid waiting for tool outputs.
 */
export async function runToolCallStreaming<T>(
  stream: AsyncIterable<Responses.ResponseStreamEvent | unknown>,
  onFunctionCall: FunctionCallHandler,
  options?: StreamHandlerOptions,
): Promise<T | undefined> {
  // Initialize context
  const context: StreamHandlerContext<T> = {
    argsByItem: new Map<string, { name?: string; buf: string }>(),
    result: undefined,
    sessionId: options?.sessionId ?? `stream_${Date.now()}`,
    options,
    onFunctionCall,
    stream: stream as AsyncIterable<unknown>,
  };

  // Log request if provided
  if (options?.logger && options.request) {
    await options.logger.write({
      type: "request",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      request: options.request,
    });
  }

  // Process stream events
  for await (const ev of stream) {
    // Validate that the event is a proper ResponseStreamEvent
    if (!isResponseStreamEvent(ev)) {
      if (options?.logger) {
        await options.logger.write({
          type: "stream.unknown_event",
          ts: new Date().toISOString(),
          sessionId: context.sessionId,
          event: ev,
        });
      }
      continue;
    }

    // Log all events
    if (options?.logger) {
      await options.logger.write({
        type: "stream.event",
        ts: new Date().toISOString(),
        sessionId: context.sessionId,
        event: ev,
      });
    }

    // Handle output item added events
    if (isOutputItemAddedEvent(ev)) {
      handleOutputItemAdded(ev, context);
      continue;
    }

    // Handle arguments delta events
    if (isArgsDeltaEvent(ev)) {
      handleArgumentsDelta(ev, context);
      continue;
    }

    // Handle arguments done events
    if (isArgsDoneEvent(ev)) {
      const result = await handleArgumentsDone(ev, context);
      if (result?.result !== undefined) {
        context.result = result.result as T;
      }
      if (result?.shouldBreak) {
        break;
      }
      continue;
    }

    // Handle output item done events
    if (isOutputItemDoneEvent(ev)) {
      const result = await handleOutputItemDone(ev, context);
      if (result?.result !== undefined) {
        context.result = result.result as T;
      }
      if (result?.shouldBreak) {
        break;
      }
      continue;
    }

    // Handle custom text delta events (not in standard types)
    if (isTextDeltaEvent(ev)) {
      await handleTextDelta(ev, context);
      continue;
    }

    // Handle custom text done events (not in standard types)
    if (isTextDoneEvent(ev)) {
      await handleTextDone(ev, context);
      continue;
    }
  }

  // Log stream completion
  if (options?.logger) {
    await options.logger.write({
      type: "stream.complete",
      ts: new Date().toISOString(),
      sessionId: context.sessionId,
      hasResult: typeof context.result !== "undefined",
    });
  }

  return context.result;
}
