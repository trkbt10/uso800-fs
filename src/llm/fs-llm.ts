/**
 * @file Optional LLM orchestrator for Uso800FS (pattern mirrored from usodb-llm).
 *
 * Provides two tool patterns via OpenAI Responses API streaming:
 * - emit_fs_listing: create dirs/files under a given folder
 * - emit_file_content: return content for a given file path
 *
 * Client injection follows the minimal surface { responses.stream(...) } to keep loose coupling.
 */
import type { FsState } from "../fakefs/state";
import { runToolCallStreaming } from "./utils/response-stream";
import { normalizeAction, reduceFs, getOpenAIToolsSpec } from "./actions/index";
import type { Responses } from "openai/resources/responses/responses";
import type { ResponseStream } from "openai/lib/responses/ResponseStream";
import type { Stream as OpenAIStream } from "openai/core/streaming";

// Minimal client surface (mirrors agents usage in usodb-llm)
type ResponsesStreamLike = ResponseStream<unknown> | OpenAIStream<Responses.ResponseStreamEvent> | AsyncIterable<Responses.ResponseStreamEvent>;
type StreamFunction = (opts: unknown) => ResponsesStreamLike | Promise<ResponsesStreamLike>;
type OpenAIResponsesLike = { responses: { stream: StreamFunction } };

/**
 * Type guard: checks if a string is a supported tool name.
 */
// tool name guard centralized in tools.ts

/**
 * Runtime check for string[] after JSON validation.
 */
// local normalization helpers replaced by tools.normalizeAction

/**
 * Runtime check for entries array after JSON validation.
 */
// local normalization helpers replaced by tools.normalizeAction

const toolsSpec = () => getOpenAIToolsSpec();

function ensureAsyncIterable<T>(x: AsyncIterable<T> | Iterable<T>): AsyncIterable<T> {
  if (x && typeof (x as AsyncIterable<T>)[Symbol.asyncIterator] === "function") {
    return x as AsyncIterable<T>;
  }
  // Wrap sync iterable into async
  const it = x as Iterable<T>;
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of it) {
        yield v;
      }
    },
  };
}

/**
 * Creates an LLM-backed FS orchestrator that consumes Responses API streams and
 * applies validated tool payloads to the provided in-memory FS state.
 *
 * Differences from a naive implementation:
 * - No implicit behavior: requires explicit client, model, and state.
 * - Validates tool payloads with JSON Schema before mutating state.
 * - Avoids unsafe casts by runtime guards after validation.
 */
export function createUsoFsLLMInstance(
  client: OpenAIResponsesLike,
  args: { model: string; instruction?: string; state: FsState },
) {
  if (!client || !client.responses || typeof client.responses.stream !== "function") {
    throw new Error("client.responses.stream is required");
  }
  if (!args || !args.model || !args.state) {
    throw new Error("model and state are required");
  }

  /** Applies a single tool invocation to the FS state. */
  async function applyTool(name: string, params: Record<string, unknown>) {
    const action = normalizeAction(name, params);
    if (!action) {
      return undefined;
    }
    return reduceFs(args.state, action);
  }

  /**
   * Requests a fabricated listing under the specified folder using LLM tool-calls.
   * Applies created entries to the in-memory FS state. No plain text output is used.
   */
  async function fabricateListing(folderPath: string[]): Promise<void> {
    const prompt = [
      "Fabricate a directory listing for the given folder.",
      "Use emit_fs_listing to create directories/files. Avoid plain text output.",
      "REQUEST=" + JSON.stringify({ path: folderPath.join("/") !== "" ? folderPath.join("/") : "/" }),
    ].join("\n\n");
    await runToolCallStreaming<void>(
      ensureAsyncIterable(client.responses.stream({
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

  /**
   * Requests fabricated file content for the specified path using LLM tool-calls.
   * Writes the returned content to the in-memory FS and returns the text.
   */
  async function fabricateFileContent(pathParts: string[]): Promise<string> {
    const prompt = [
      "Fabricate file content for the given path.",
      "Use emit_file_content to deliver the content. Avoid plain text output.",
      "REQUEST=" + JSON.stringify({ path: pathParts.join("/") !== "" ? pathParts.join("/") : "/" }),
    ].join("\n\n");
    const res = await runToolCallStreaming<string>(
      ensureAsyncIterable(client.responses.stream({
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
    return typeof res === "string" ? res : "";
  }

  return { fabricateListing, fabricateFileContent };
}
