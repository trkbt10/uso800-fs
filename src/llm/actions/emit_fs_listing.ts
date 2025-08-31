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
    const folder = isStringArray(params.folder) ? params.folder : undefined;
    const entries = toEntries(params.entries);
    if (!folder) {
      return undefined;
    }
    return { type: "emit_fs_listing", params: { folder, entries } };
  },
};
