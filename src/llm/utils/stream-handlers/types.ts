/**
 * @file Common types and interfaces for stream event handlers.
 */

import type { Responses } from "openai/resources/responses/responses";

/**
 * Function call handler type.
 */
export type FunctionCallHandler = (args: {
  name?: string;
  params: Record<string, unknown>;
}) => Promise<unknown> | unknown;

/**
 * Logger interface for stream events.
 */
export type StreamLogger = {
  write: (obj: unknown) => Promise<void>;
}

/**
 * Stream handler options.
 */
export type StreamHandlerOptions = {
  endAfterFirst?: boolean;
  onFunctionOutputTextDelta?: (args: { itemId: string; name?: string; delta: string }) => void | Promise<void>;
  onFunctionOutputTextDone?: (args: { itemId: string; name?: string }) => void | Promise<void>;
  logger?: StreamLogger;
  sessionId?: string;
  request?: unknown;
}

/**
 * Context passed to all stream handlers.
 */
export type StreamHandlerContext<T = unknown> = {
  argsByItem: Map<string, { name?: string; buf: string }>;
  result: T | undefined;
  sessionId: string;
  options?: StreamHandlerOptions;
  onFunctionCall: FunctionCallHandler;
  stream: AsyncIterable<unknown>;
}

/**
 * Result of handling a stream event.
 */
export type HandlerResult<T = unknown> = {
  shouldBreak?: boolean;
  result?: T;
}

/**
 * Stream event handler function type.
 */
export type StreamEventHandler<E = Responses.ResponseStreamEvent, T = unknown> = (
  event: E,
  context: StreamHandlerContext<T>
) => Promise<HandlerResult<T> | void> | HandlerResult<T> | void;

// Test helper accumulator type (used by unit specs)
export type StreamAccumulator = {
  accumulated: string;
  argAccumulated: Map<string, string>;
  itemAdded: boolean;
  outputDone: boolean;
  toolCalls: Map<string, { name?: string; arguments?: string; call_id?: string }>;
};
