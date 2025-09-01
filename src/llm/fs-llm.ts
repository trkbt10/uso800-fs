/**
 * @file LLM orchestrator that works directly with PersistAdapter.
 */
import type { PersistAdapter } from "../webdav/persist/types";
import type { Tracker } from "../logging/tracker";
import { getOpenAIToolsSpec, normalizeAction, type ToolSpec } from "./actions/tools";
import { runToolCallStreaming } from "./utils/response-stream";
import type OpenAI from "openai";
import type { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import type { Responses } from "openai/resources/responses/responses";
import { buildListingPrompt, buildFileContentPrompt } from "./utils/prompt-builder";

const allTools = () => getOpenAIToolsSpec();
function selectTools(names: string[]): ToolSpec[] {
  const set = new Set(names);
  return allTools().filter((t) => set.has(t.name));
}

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

/**
 * Minimal OpenAI client interface for Responses API.
 */
export type OpenAIResponsesClient = {
  responses: {
    stream: (
      body: ResponseStreamParams,
      options?: OpenAI.RequestOptions,
    ) => AsyncIterable<Responses.ResponseStreamEvent> | Promise<AsyncIterable<Responses.ResponseStreamEvent>>;
  };
};

function keyOf(parts: string[]): string {
  if (!Array.isArray(parts)) {
    return "/";
  }
  return "/" + parts.filter((p) => p !== "" && p !== "/").join("/");
}

/**
 * Creates a persist-backed LLM orchestrator. Requires an OpenAI client with
 * Responses API, the target model name, optional instruction, and a PersistAdapter
 * for applying tool effects (dirs/files creation and file writes).
 */
export function createUsoFsLLMInstance(
  client: OpenAIResponsesClient,
  args: { model: string; instruction?: string; persist: PersistAdapter; tracker?: Tracker },
) {
  if (!client || !client.responses || typeof client.responses.stream !== "function") {
    throw new Error("client.responses.stream is required");
  }
  if (!args || !args.model || !args.persist) {
    throw new Error("model and persist are required");
  }

  // In-flight coalescing to avoid duplicate LLM runs for the same target
  const inflight = {
    listing: new Map<string, Promise<void>>(),
    file: new Map<string, Promise<string>>()
  } as const;

  function withCoalescing<T>(map: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
    const existing = map.get(key);
    if (existing) {
      return existing;
    }
    const p = (async () => run())()
      .finally(() => {
        map.delete(key);
      });
    map.set(key, p);
    return p;
  }

  /**
   * Requests a fabricated listing under the specified folder using LLM tool-calls.
   */
  async function fabricateListing(folderPath: string[], options?: { depth?: string | null }): Promise<void> {
    const key = `LISTING:${keyOf(folderPath)}:DEPTH:${options?.depth ?? "null"}`;
    return withCoalescing(inflight.listing, key, async () => {
    const listingStats: { dirs: number; files: number; bytes: number; dirNames: string[]; fileNames: string[] } = {
      dirs: 0,
      files: 0,
      bytes: 0,
      dirNames: [],
      fileNames: [],
    };
    // Use the tested prompt builder
    const promptResult = buildListingPrompt(folderPath, {
      depth: options?.depth,
      instruction: args.instruction,
    });
    const prompt = promptResult.prompt;
      
    const request: ResponseStreamParams = {
      model: args.model,
      instructions: args.instruction,
      input: [{ role: "user", content: prompt }],
      tools: selectTools(["emit_fs_listing"]),
      tool_choice: { type: "function", name: "emit_fs_listing" },
    };
    // Log LLM start
    {
      const displayPath = promptResult.displayPath;
      const promptPreview = prompt.slice(0, 200);
      if (args.tracker) {
        args.tracker.track("llm.start", { context: "fabricateListing", path: displayPath, depth: options?.depth ?? null, model: args.model, promptPreview });
      }
    }
    const stream = await client.responses.stream(request);
    await runToolCallStreaming<void>(
      ensureAsyncIterable(stream),
      ({ name, params }) => {
        if (!name) { return undefined; }
        const action = normalizeAction(name, params);
        if (!action) { return undefined; }
        if (action.type !== "emit_fs_listing") { return undefined; }
        const { folder, entries } = action.params as { folder: string[]; entries: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }> };
        return (async () => {
          await args.persist.ensureDir(folder);
          for (const e of entries) {
            if (e.kind === "dir") {
              await args.persist.ensureDir([...folder, e.name]);
              listingStats.dirs += 1;
              listingStats.dirNames.push(e.name);
            } else {
              await args.persist.ensureDir([...folder]);
              const data = new TextEncoder().encode(e.content);
              await args.persist.writeFile([...folder, e.name], data, e.mime);
              listingStats.files += 1;
              listingStats.bytes += data.length;
              listingStats.fileNames.push(e.name);
            }
          }
          return undefined;
        })();
      },
      { endAfterFirst: true },
    );
    {
      const displayPath = promptResult.displayPath;
      if (args.tracker) {
        args.tracker.track("llm.end", { context: "fabricateListing", path: displayPath, stats: listingStats });
      }
    }
    });
  }

  /**
   * Requests fabricated file content for the specified path using LLM tool-calls.
   */
  async function fabricateFileContent(pathParts: string[], options?: { mimeHint?: string }): Promise<string> {
    const key = `FILE:${keyOf(pathParts)}:MIME:${options?.mimeHint ?? ""}`;
    return withCoalescing(inflight.file, key, async () => {
    const fileStats: { files: number; bytes: number; fileName?: string } = { files: 0, bytes: 0 };
    // Use the tested prompt builder
    const promptResult = buildFileContentPrompt(pathParts, {
      mimeHint: options?.mimeHint,
      instruction: args.instruction,
    });
    const prompt = promptResult.prompt;
      
    const request: ResponseStreamParams = {
      model: args.model,
      instructions: args.instruction,
      input: [{ role: "user", content: prompt }],
      tools: selectTools(["emit_file_content"]),
      tool_choice: { type: "function", name: "emit_file_content" },
    };
    // Log LLM start
    {
      const displayPath = promptResult.displayPath;
      const promptPreview = prompt.slice(0, 200);
      if (args.tracker) {
        args.tracker.track("llm.start", { context: "fabricateFileContent", path: displayPath, mimeHint: options?.mimeHint ?? null, model: args.model, promptPreview });
      }
    }
    const stream = await client.responses.stream(request);
    const res = await runToolCallStreaming<string>(
      ensureAsyncIterable(stream),
      ({ name, params }) => {
        if (!name) { return undefined; }
        const action = normalizeAction(name, params);
        if (!action) { return undefined; }
        if (action.type !== "emit_file_content") { return undefined; }
        const { path, content, mime } = action.params as { path: string[]; content: string; mime: string };
        return (async () => {
          await args.persist.ensureDir(path.slice(0, -1));
          const data = new TextEncoder().encode(content);
          await args.persist.writeFile(path, data, mime);
          fileStats.files += 1;
          fileStats.bytes += data.length;
          fileStats.fileName = path[path.length - 1];
          return content;
        })();
      },
      { endAfterFirst: true },
    );
    {
      const displayPath = promptResult.displayPath;
      if (args.tracker) {
        args.tracker.track("llm.end", { context: "fabricateFileContent", path: displayPath, stats: fileStats });
      }
    }
    return typeof res === "string" ? res : "";
    });
  }

  return { fabricateListing, fabricateFileContent };
}
