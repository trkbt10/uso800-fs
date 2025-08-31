/**
 * @file Action: emit_file_content
 *
 * Produces content for a specific file path. Content should match the filetype/mime
 * and stay brief, cohesive, and playful.
 */
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

type EmitFileContentAction = { type: "emit_file_content"; params: { path: string[]; content: string; mime: string } };

export const emit_file_content: ToolAction<EmitFileContentAction> = {
  function: {
    type: "function",
    name: "emit_file_content",
    strict: true,
    description:
      "Generate short, cohesive text for the requested file. " +
      "Respect the filename extension and any MIME hints.",
    parameters: {
      type: "object",
      description: "Parameters for fabricating a file's textual content.",
      properties: {
        path: {
          type: "array",
          description: "Target path segments from the root. Last segment is the filename.",
          minItems: 1,
          items: { type: "string", description: "A single path segment (no slashes).", minLength: 1, pattern: "^[^/]+$" },
        },
        content: {
          type: "string",
          description: "The file's textual content. Keep within a few lines when possible.",
          minLength: 0,
        },
        mime: {
          type: "string",
          description: "The MIME type for the content (e.g., text/plain, text/markdown).",
          pattern: "^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$",
        },
      },
      required: ["path", "content", "mime"],
      additionalProperties: false,
    },
  },
  normalize: (params: Record<string, unknown>): EmitFileContentAction | undefined => {
    const path = isStringArray(params.path) ? params.path : undefined;
    const content = typeof params.content === "string" ? params.content : undefined;
    const mime = typeof params.mime === "string" ? params.mime : undefined;
    if (!path || typeof content !== "string" || typeof mime !== "string") {
      return undefined;
    }
    return { type: "emit_file_content", params: { path, content, mime } };
  },
};
