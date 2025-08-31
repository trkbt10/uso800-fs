/**
 * @file WebDAV hooks implementation backed by the LLM orchestrator.
 */
import type { WebDavHooks } from "../webdav/hooks";

export type LlmOrchestrator = {
  fabricateListing: (path: string[], opts?: { depth?: string | null }) => Promise<void>;
  fabricateFileContent: (path: string[], opts?: { mimeHint?: string }) => Promise<string>;
};

export function createLlmWebDavHooks(llm: LlmOrchestrator): WebDavHooks {
  return {
    async beforeGet({ segments, persist }) {
      // If missing or empty file, generate content once
      const exists = await persist.exists(segments);
      if (!exists) {
        try {
          const content = await llm.fabricateFileContent(segments);
          if (content) {
            if (segments.length > 1) { await persist.ensureDir(segments.slice(0, -1)); }
            await persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
          }
        } catch { /* ignore */ }
      } else {
        try {
          const st = await persist.stat(segments);
          if (st.type === "file" && (st.size ?? 0) === 0) {
            const content = await llm.fabricateFileContent(segments);
            if (content) {
              if (segments.length > 1) { await persist.ensureDir(segments.slice(0, -1)); }
              await persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
            }
          }
        } catch { /* ignore */ }
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
        const content = await llm.fabricateFileContent(segments);
        if (content) {
          setBody(new TextEncoder().encode(content), "text/plain");
        }
      } catch { /* ignore */ }
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

