/**
 * @file Implementation of fabricateFileContent as a focused module.
 */
import type { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import type { Responses } from "openai/resources/responses/responses";
import { buildFileContentPrompt } from "../utils/prompt-builder";
import { getOpenAIToolsSpec, normalizeAction } from "../actions/tools";
import { runToolCallStreaming } from "../utils/response-stream";
import type { FileDeps } from "./types";
import { processEmitFile as execProcessEmitFile } from "../executors/fs-actions";

/**
 * Orchestrates a single file fabrication using OpenAI Responses tool-calls.
 *
 * Behavior:
 * - Builds a prompt (instruction/mimeHint aware) for the requested file path.
 * - Requests the model with tools limited to `emit_file_content` and `emit_image_file`.
 * - On `function_call.arguments.done`, writes content via FS executor and returns response text (empty for images).
 * - Emits tracker events for `llm.start` / `llm.end` with lightweight stats.
 * - Coalesces concurrent requests per file+mime key using `withCoalescing`.
 *
 * Differences from a superficial implementation:
 * - No textual JSON fallback; enforces tool-call path to avoid ambiguity.
 * - Image prompts are handled by the image tool and routed to image generation + transcode via executor.
 *
 * @param deps Common orchestrator dependencies and file-specific inflight map.
 * @param pathParts File path segments from root; last segment is the filename.
 * @param options Optional hints (e.g., mimeHint) to influence the prompt.
 */
export async function fabricateFileImpl(
  deps: FileDeps,
  pathParts: string[],
  options?: { mimeHint?: string },
): Promise<string> {
  const key = `FILE:${deps.keyOf(pathParts)}:MIME:${options?.mimeHint ?? ""}`;
  return deps.withCoalescing(deps.inflight, key, async () => {
    const stats: { files: number; bytes: number; fileName?: string } = { files: 0, bytes: 0 };

    const promptResult = buildFileContentPrompt(pathParts, { mimeHint: options?.mimeHint, instruction: deps.instruction });
    const prompt = promptResult.prompt;

    const request: ResponseStreamParams = {
      model: deps.model,
      instructions: deps.instruction,
      input: [{ role: "user", content: prompt }],
      tools: getOpenAIToolsSpec().filter((t) => t.name === "emit_file_content" || t.name === "emit_image_file"),
    };

    if (deps.tracker) {
      const displayPath = promptResult.displayPath;
      const promptPreview = prompt.slice(0, 200);
      deps.tracker.track("llm.start", { context: "fabricateFileContent", path: displayPath, mimeHint: options?.mimeHint ?? null, model: deps.model, promptPreview });
    }

    const stream = await deps.client.responses.stream(request);
    async function process(path: string[], content: string, mime: string): Promise<string> {
      return execProcessEmitFile(deps.execDeps, stats, path, content, mime);
    }
    const res = await runToolCallStreaming<string>(
      stream as AsyncIterable<Responses.ResponseStreamEvent>,
      ({ name, params }) => {
        if (!name) { return undefined; }
        const a = normalizeAction(name, params);
        if (!a) { return undefined; }
        if (a.type === "emit_file_content") {
          const { path, content, mime } = a.params;
          return process(path, content, mime);
        }
        if (a.type === "emit_image_file") {
          const { path, prompt: iprompt, mime } = a.params;
          return process(path, iprompt, mime);
        }
        return undefined;
      },
      { endAfterFirst: true },
    );

    if (deps.tracker) {
      const displayPath = promptResult.displayPath;
      deps.tracker.track("llm.end", { context: "fabricateFileContent", path: displayPath, stats });
    }
    return typeof res === "string" ? res : "";
  });
}
