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
      "Generate short, cohesive text for the requested file. " + "Respect the filename extension and any MIME hints.",
    parameters: {
      type: "object",
      description: "Parameters for fabricating a file's textual content.",
      properties: {
        path: {
          type: "array",
          description: "Target path segments from the root. Last segment is the filename.",
          minItems: 1,
          items: {
            type: "string",
            description: "A single path segment (no slashes).",
            minLength: 1,
            pattern: "^[^/]+$",
          },
        },
        content: {
          type: "string",
          description: "The file's textual content. Keep within a few lines when possible.",
          minLength: 0,
        },
        mime: {
          type: "string",
          description: "The MIME type for the content (e.g., text/plain, text/markdown).",
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

/**
 * Runtime guard for JSON fallback payloads that resemble emit_file_content params.
 */
export function isEmitTextFilePayload(x: unknown): x is { path: string[]; content: string; mime: string } {
  if (typeof x !== "object" || x === null) { return false; }
  const r = x as Record<string, unknown>;
  if (!isStringArray(r.path)) { return false; }
  if (typeof r.content !== "string") { return false; }
  if (typeof r.mime !== "string") { return false; }
  return true;
}
