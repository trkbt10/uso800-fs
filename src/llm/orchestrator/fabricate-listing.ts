/**
 * @file Implementation of fabricateListing as a focused module.
 */
import type { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import type { Responses } from "openai/resources/responses/responses";
import { buildListingPrompt } from "../utils/prompt-builder";
import { getOpenAIToolsSpec, normalizeAction } from "../actions/tools";
import { runToolCallStreaming } from "../utils/response-stream";
import type { ListingDeps } from "./types";
import { processFsListing as execProcessFsListing } from "../executors/fs-actions";

/**
 * Orchestrates a single listing fabrication using OpenAI Responses tool-calls.
 *
 * Behavior:
 * - Builds a prompt (depth/instruction aware) for the target folder.
 * - Requests the model to call only `emit_fs_listing` and streams the response.
 * - On `function_call.arguments.done`, validates and applies entries via `execProcessFsListing`.
 * - Emits tracker events for `llm.start` / `llm.end` with lightweight stats.
 * - Coalesces concurrent requests for the same target using the provided `withCoalescing`.
 *
 * Differences from a superficial implementation:
 * - Does not attempt textual JSON fallback; relies strictly on tool-calls for determinism.
 * - Applies entries through the FS executor to keep side effects and counting centralized.
 *
 * @param deps Common orchestrator dependencies and listing-specific inflight map.
 * @param folderPath Target folder path segments (empty = root).
 * @param options Optional listing options (e.g., WebDAV Depth header value).
 */
export async function fabricateListingImpl(
  deps: ListingDeps,
  folderPath: string[],
  options?: { depth?: string | null },
): Promise<void> {
  const key = `LISTING:${deps.keyOf(folderPath)}:DEPTH:${options?.depth ?? "null"}`;
  return deps.withCoalescing(deps.inflight, key, async () => {
    const stats: { dirs: number; files: number; bytes: number; dirNames: string[]; fileNames: string[] } = {
      dirs: 0,
      files: 0,
      bytes: 0,
      dirNames: [],
      fileNames: [],
    };

    const promptResult = buildListingPrompt(folderPath, { 
      depth: options?.depth, 
      instruction: deps.instruction,
      textInstruction: deps.textInstruction,
      imageInstruction: deps.imageInstruction
    });
    const prompt = promptResult.prompt;

    const request: ResponseStreamParams = {
      model: deps.model,
      instructions: deps.instruction,
      input: [{ role: "user", content: prompt }],
      tools: getOpenAIToolsSpec().filter((t) => t.name === "emit_fs_listing"),
      tool_choice: { type: "function", name: "emit_fs_listing" },
    };
    if (deps.tracker) {
      const displayPath = promptResult.displayPath;
      const promptPreview = prompt.slice(0, 200);
      deps.tracker.track("llm.start", { context: "fabricateListing", path: displayPath, depth: options?.depth ?? null, model: deps.model, promptPreview });
    }

    const stream = await deps.client.responses.stream(request);
    async function process(folder: string[], entries: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }>): Promise<void> {
      await execProcessFsListing(deps.execDeps, stats, folder, entries);
    }
    await runToolCallStreaming<void>(
      stream as AsyncIterable<Responses.ResponseStreamEvent>,
      ({ name, params }) => {
        if (!name) { return undefined; }
        const a = normalizeAction(name, params);
        if (!a || a.type !== "emit_fs_listing") { return undefined; }
        const { folder, entries } = a.params;
        return process(folder, entries);
      },
      { endAfterFirst: true },
    );
    if (deps.tracker) {
      const displayPath = promptResult.displayPath;
      deps.tracker.track("llm.end", { context: "fabricateListing", path: displayPath, stats });
    }
  });
}
