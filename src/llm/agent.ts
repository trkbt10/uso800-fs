/**
 * @file FS LLM Agent: consumes a mock Responses API stream and applies validated tool payloads to FS state.
 *
 * Differences from a naive approach:
 * - Explicit tool schema validation before state mutation
 * - Runtime type guards to avoid unsafe casts
 */
import type { FsState } from "../fakefs/state";
// state helpers are applied via reduceFs from tools.ts
import { runToolCallStreaming } from "./utils/response-stream";
import { normalizeAction, reduceFs, getOpenAIToolsSpec } from "./actions/index";
import type { Responses } from "openai/resources/responses/responses";
import type { ResponseStream } from "openai/lib/responses/ResponseStream";
import type { Stream as OpenAIStream } from "openai/core/streaming";

// Minimal client surface; compatible with mock streams.
type ResponsesStreamLike = ResponseStream<unknown> | OpenAIStream<Responses.ResponseStreamEvent> | AsyncIterable<Responses.ResponseStreamEvent>;
type StreamFunction = (opts: unknown) => ResponsesStreamLike | Promise<ResponsesStreamLike>;
type ClientLike = { responses: { stream: StreamFunction } };

// local type helpers removed; use tools.normalizeAction instead

function ensureAsyncIterable<T>(x: AsyncIterable<T> | Iterable<T>): AsyncIterable<T> {
  if (x && typeof (x as AsyncIterable<T>)[Symbol.asyncIterator] === "function") {
    return x as AsyncIterable<T>;
  }
  const it = x as Iterable<T>;
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of it) {
        yield v;
      }
    },
  };
}

const toolsSpec = () => getOpenAIToolsSpec();

/**
 * Creates a mock-stream-driven FS agent for unit tests and local runs.
 *
 * - Requires explicit client with `responses.stream`.
 * - Mutations only occur after schema validation; unsafe casts are avoided.
 */
export function createFsAgent(client: ClientLike, args: { model: string; state: FsState; instruction?: string }) {
  /** Applies a validated tool invocation to the provided FS state. */
  async function applyTool(name: string, params: Record<string, unknown>) {
    const action = normalizeAction(name, params);
    if (!action) {
      return undefined;
    }
    return reduceFs(args.state, action);
  }

  /**
   * Runs a single-turn prompt against the mock Responses stream.
   * The first completed function_call is applied and the stream is aborted.
   */
  async function runWithMock(prompt: string) {
    // Note: in tests, client.responses.stream is mocked to yield a single function_call
    await runToolCallStreaming<void>(
      ensureAsyncIterable(await client.responses.stream({
        model: args.model,
        instructions: args.instruction,
        input: [{ role: "user", content: prompt }],
        tools: toolsSpec(),
        tool_choice: "required",
      })),
      ({ name, params }) => {
        if (!name) {
          return undefined;
        }
        return applyTool(name, params);
      },
      { endAfterFirst: true },
    );
  }

  return { runWithMock };
}
