/**
 * @file Action: emit_fs_listing
 *
 * Generates a listing for a target folder by declaring directories/files to create.
 * This is the primary tool for fabricating believable structures.
 */
import { isStringArray, toEntries } from "./util";
import type { ToolAction } from "./types";

type EmitFsListingAction = {
  type: "emit_fs_listing";
  params: {
    folder: string[];
    entries: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }>;
  };
};

export const emit_fs_listing: ToolAction<EmitFsListingAction> = {
  function: {
    type: "function",
    name: "emit_fs_listing",
    strict: true,
    // What this tool does and when/how to use it.
    // Emphasize coherence: small, plausible groupings that feel related to the folder.
    description:
      "Create a plausible folder listing for the requested path by declaring new directories and files. " +
      "Favor cohesion (2–5 entries), short names, and playful, believable content.",
    parameters: {
      type: "object",
      description:
        "Parameters for fabricating a directory listing. 'entries' should include at least one dir and one file.",
      properties: {
        folder: {
          type: "array",
          description: "Target path segments from the root. Empty array means root.",
          items: {
            type: "string",
            description: "A single path segment (no slashes).",
            minLength: 1,
            pattern: "^[^/]+$",
          },
        },
        entries: {
          type: "array",
          description: "Entries to create under the folder. Include a mix of dirs/files.",
          minItems: 1,
          items: {
            type: "object",
            description: "A directory or a file to create in the target folder.",
            properties: {
              kind: { type: "string", enum: ["dir", "file"], description: "Entry type to create." },
              name: {
                type: "string",
                description: "Entry name (no slashes). Keep it short and friendly.",
                minLength: 1,
                pattern: "^[^/]+$",
              },
              content: {
                type: "string",
                description: "If kind=file, the textual content to write. Keep it concise and witty.",
                minLength: 0,
              },
              mime: {
                type: "string",
                description: "If kind=file, the MIME type for the content (e.g., text/plain, text/markdown).",
              },
            },
            required: ["kind", "name", "content", "mime"],
            additionalProperties: false,
          },
        },
      },
      required: ["folder", "entries"],
      additionalProperties: false,
    },
  },
  normalize: (params: Record<string, unknown>): EmitFsListingAction | undefined => {
    const folder = (() => {
      if (isStringArray(params.folder)) { return params.folder; }
      const p = params.path;
      if (typeof p === "string") { return p.split("/").filter((s) => s.length > 0); }
      if (isStringArray(p)) { return p; }
      return undefined;
    })();
    const entries = toEntries(params.entries);
    if (!folder) {
      return undefined;
    }
    return { type: "emit_fs_listing", params: { folder, entries } };
  },
};

/**
 * Runtime guard for JSON fallback payloads that resemble emit_fs_listing params.
 * Validates folder is string[] and each entry is a valid dir/file item.
 */
export function isEmitFsListingPayload(x: unknown): x is { folder: string[]; entries: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }> } {
  if (typeof x !== "object" || x === null) { return false; }
  const r = x as Record<string, unknown>;
  if (!isStringArray(r.folder)) { return false; }
  const entries = r.entries;
  if (!Array.isArray(entries)) { return false; }
  for (const it of entries) {
    if (typeof it !== "object" || it === null) { return false; }
    const e = it as Record<string, unknown>;
    const kind = e.kind;
    const name = e.name;
    if (kind !== "dir" && kind !== "file") { return false; }
    if (typeof name !== "string" || name.length === 0) { return false; }
    if (kind === "file") {
      if (typeof e.content !== "string") { return false; }
      if (typeof e.mime !== "string") { return false; }
    }
  }
  return true;
}
