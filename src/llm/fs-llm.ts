/**
 * @file LLM orchestrator that works directly with PersistAdapter.
 */
import type { PersistAdapter } from "../persist/types";
import type { Tracker } from "../logging/tracker";
import { getOpenAIToolsSpec, normalizeAction, type ToolSpec } from "./actions/tools";
import { runToolCallStreaming } from "./utils/response-stream";
import type OpenAI from "openai";
import type { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import type { Responses } from "openai/resources/responses/responses";

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
type OpenAIResponsesClient = {
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
  return "/" + parts.filter((p) => p && p !== "/").join("/");
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

  // Per-invocation stats (reset inside each public method)
  let listingStats: { dirs: number; files: number; bytes: number; dirNames: string[]; fileNames: string[] } = {
    dirs: 0,
    files: 0,
    bytes: 0,
    dirNames: [],
    fileNames: [],
  };
  let fileStats: { files: number; bytes: number; fileName?: string } = { files: 0, bytes: 0 };

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
   * Applies a tool invocation to the filesystem via PersistAdapter.
   */
  async function applyTool(name: string, params: Record<string, unknown>) {
    const action = normalizeAction(name, params);
    if (!action) {
      return undefined;
    }
    if (action.type === "emit_fs_listing") {
      const { folder, entries } = action.params as { folder: string[]; entries: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }> };
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
    }
    if (action.type === "emit_file_content") {
      const { path, content, mime } = action.params as { path: string[]; content: string; mime: string };
      await args.persist.ensureDir(path.slice(0, -1));
      const data = new TextEncoder().encode(content);
      await args.persist.writeFile(path, data, mime);
      fileStats.files += 1;
      fileStats.bytes += data.length;
      fileStats.fileName = path[path.length - 1];
      return content;
    }
    
    return undefined;
  }

  /**
   * Requests a fabricated listing under the specified folder using LLM tool-calls.
   */
  async function fabricateListing(folderPath: string[], options?: { depth?: string | null }): Promise<void> {
    const key = `LISTING:${keyOf(folderPath)}:DEPTH:${options?.depth ?? "null"}`;
    return withCoalescing(inflight.listing, key, async () => {
    function buildListingHints(parts: string[], depth?: string | null): string[] {
      const tokens = parts.join("/").toLowerCase();
      const hints: string[] = [];
      if (tokens.includes("src")) {
        hints.push("Prefer small, plausible codey names (e.g., utils, main.ts, routes/)");
      }
      if (tokens.includes("doc") || tokens.includes("readme")) {
        hints.push("Include docs-like files (README.md, guide.md, changelog.md)");
      }
      if (tokens.includes("music") || tokens.includes("song")) {
        hints.push("Invent tracklists and lyric snippets in .txt or .md");
      }
      if (!hints.length) {
        hints.push("Mix 1-2 dirs and 1-3 files with playful names");
      }
      if (depth && depth !== "0") {
        hints.push("Allow one level of nested subfolders if it improves coherence");
      }
      return hints;
    }

    const prompt = [
      "Fabricate a directory listing for the given folder.",
      "You MUST call emit_fs_listing exactly once and include at least one directory and one file in 'entries'.",
      "Avoid any plain text output; only use the function call.",
      options?.depth ? `WEBDAV_DEPTH=${options.depth}` : undefined,
      "STYLE_HINTS:\n- " + buildListingHints(folderPath, options?.depth).join("\n- "),
      "REQUEST=" + JSON.stringify({ path: folderPath.join("/") !== "" ? folderPath.join("/") : "/" }),
    ]
      .filter(Boolean)
      .join("\n\n");
      
    const request: ResponseStreamParams = {
      model: args.model,
      instructions: args.instruction,
      input: [{ role: "user", content: prompt }],
      tools: selectTools(["emit_fs_listing"]),
      tool_choice: { type: "function", name: "emit_fs_listing" },
    };
    // Reset stats and log LLM start
    listingStats = { dirs: 0, files: 0, bytes: 0, dirNames: [], fileNames: [] };
    {
      const joined = folderPath.join("/");
      const displayPath = "/" + (joined !== "" ? joined : "");
      const promptPreview = prompt.slice(0, 200);
      if (args.tracker) {
        args.tracker.track("llm.start", { context: "fabricateListing", path: displayPath, depth: options?.depth ?? null, model: args.model, promptPreview });
      }
    }
    const stream = await client.responses.stream(request);
    await runToolCallStreaming<void>(
      ensureAsyncIterable(stream),
      ({ name, params }) => {
        if (!name) {
          return undefined;
        }
        return applyTool(name, params);
      },
      { endAfterFirst: true },
    );
    {
      const joined = folderPath.join("/");
      const displayPath = "/" + (joined !== "" ? joined : "");
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
    const ext = pathParts[pathParts.length - 1]?.split(".").pop();
    const hint = options?.mimeHint;
    function buildFileHints(parts: string[], ext?: string, mime?: string): string[] {
      const name = parts[parts.length - 1]?.toLowerCase() ?? "";
      const baseHints: string[] = [];
      if (ext === "md") {
        baseHints.push("Start with a title heading and keep it concise");
      }
      if (ext === "json") {
        baseHints.push("Return minified valid JSON with 3-6 keys");
      }
      if (name.includes("readme")) {
        baseHints.push("Provide a playful overview and quickstart bullets");
      }
      if (name.includes("todo")) {
        baseHints.push("Use a short checklist with 4-6 items");
      }
      if (!baseHints.length) {
        baseHints.push("Keep it short, witty, and cohesive");
      }
      if (mime) {
        baseHints.push(`Ensure content matches MIME: ${mime}`);
      }
      return baseHints;
    }
    const prompt = [
      "Fabricate file content for the given path.",
      "Use emit_file_content to deliver the content. Avoid plain text output.",
      ext ? `FILENAME_EXT=.${ext}` : undefined,
      hint ? `MIME_HINT=${hint}` : undefined,
      "STYLE_HINTS:\n- " + buildFileHints(pathParts, ext, hint).join("\n- "),
      "REQUEST=" + JSON.stringify({ path: pathParts.join("/") !== "" ? pathParts.join("/") : "/" }),
    ]
      .filter(Boolean)
      .join("\n\n");
      
    const request: ResponseStreamParams = {
      model: args.model,
      instructions: args.instruction,
      input: [{ role: "user", content: prompt }],
      tools: selectTools(["emit_file_content"]),
      tool_choice: { type: "function", name: "emit_file_content" },
    };
    // Reset stats and log LLM start
    fileStats = { files: 0, bytes: 0, fileName: undefined };
    {
      const joined = pathParts.join("/");
      const displayPath = "/" + (joined !== "" ? joined : "");
      const promptPreview = prompt.slice(0, 200);
      if (args.tracker) {
        args.tracker.track("llm.start", { context: "fabricateFileContent", path: displayPath, mimeHint: options?.mimeHint ?? null, model: args.model, promptPreview });
      }
    }
    const stream = await client.responses.stream(request);
    const res = await runToolCallStreaming<string>(
      ensureAsyncIterable(stream),
      ({ name, params }) => {
        if (!name) {
          return undefined;
        }
        return applyTool(name, params);
      },
      { endAfterFirst: true },
    );
    {
      const joined = pathParts.join("/");
      const displayPath = "/" + (joined !== "" ? joined : "");
      if (args.tracker) {
        args.tracker.track("llm.end", { context: "fabricateFileContent", path: displayPath, stats: fileStats });
      }
    }
    return typeof res === "string" ? res : "";
    });
  }

  return { fabricateListing, fabricateFileContent };
}
