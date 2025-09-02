/**
 * @file WebDAV hooks implementation backed by the LLM orchestrator.
 */
import type { WebDavHooks } from "../webdav/hooks";

export type LlmOrchestrator = {
  fabricateListing: (path: string[], opts?: { depth?: string | null }) => Promise<void>;
  fabricateFileContent: (path: string[], opts?: { mimeHint?: string }) => Promise<string>;
};

/**
 * Best-effort MIME inference based on filename extension.
 * Used to make image generation explicit and reduce LLM ambiguity.
 */
function inferMimeFromPath(segments: string[]): string | undefined {
  const name = segments.length > 0 ? segments[segments.length - 1] : "";
  const idx = name.lastIndexOf(".");
  if (idx <= 0) { return undefined; }
  const ext = name.slice(idx + 1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") { return "image/jpeg"; }
  if (ext === "png") { return "image/png"; }
  if (ext === "gif") { return "image/gif"; }
  if (ext === "webp") { return "image/webp"; }
  if (ext === "avif") { return "image/avif"; }
  if (ext === "svg") { return "image/svg+xml"; }
  if (ext === "txt") { return "text/plain"; }
  if (ext === "md" || ext === "markdown") { return "text/markdown"; }
  if (ext === "json") { return "application/json"; }
  return undefined;
}

/**
 * Creates WebDAV hooks backed by the LLM orchestrator.
 * It appears to be simple pass-throughs; actually it injects generation on
 * missing/empty reads and directories, and post-MKCOL population.
 */
export function createLlmWebDavHooks(llm: LlmOrchestrator): WebDavHooks {
  return {
    async beforeGet({ segments, persist }) {
      // If missing or empty file, generate content once
      const exists = await persist.exists(segments);
      if (!exists) {
        try {
          const mimeHint = inferMimeFromPath(segments);
          const content = await llm.fabricateFileContent(segments, { mimeHint });
          if (content) {
            if (segments.length > 1) { await persist.ensureDir(segments.slice(0, -1)); }
            await persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
          }
        } catch (e) {
          // Log generation failure to aid troubleshooting (images return empty string on success)
          console.warn("[uso800fs] fabricateFileContent failed:", (e as Error)?.message ?? e);
        }
      } else {
        try {
          const st = await persist.stat(segments);
          if (st.type === "file" && (st.size ?? 0) === 0) {
            const mimeHint = inferMimeFromPath(segments);
            const content = await llm.fabricateFileContent(segments, { mimeHint });
            if (content) {
              if (segments.length > 1) { await persist.ensureDir(segments.slice(0, -1)); }
              await persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
            }
          }
        } catch (e) {
          console.warn("[uso800fs] fabricateFileContent failed:", (e as Error)?.message ?? e);
        }
      }
      return undefined;
    },

    async beforePropfind({ segments, depth, persist }) {
      // If target folder missing or empty, generate listing once
      try {
        const exists = await persist.exists(segments);
        if (!exists) {
          await llm.fabricateListing(segments, { depth });
          return undefined;
        }
        const st = await persist.stat(segments);
        if (st.type === "dir") {
          const names = await persist.readdir(segments);
          if (names.length === 0) {
            await llm.fabricateListing(segments, { depth });
          }
        }
      } catch { /* ignore */ }
      return undefined;
    },

    async beforePut({ segments, body, setBody }) {
      if (body.byteLength > 0) {
        return undefined;
      }
      try {
        const mimeHint = inferMimeFromPath(segments);
        const content = await llm.fabricateFileContent(segments, { mimeHint });
        if (content) {
          setBody(new TextEncoder().encode(content), "text/plain");
        }
      } catch (e) {
        console.warn("[uso800fs] fabricateFileContent failed:", (e as Error)?.message ?? e);
      }
      return undefined;
    },

    async afterMkcol({ segments }) {
      try {
        await llm.fabricateListing(segments);
      } catch { /* ignore */ }
      return undefined;
    },
  };
}
