/**
 * @file Action: emit_image_file
 *
 * Requests creation of an image file at a specific path using a concise prompt.
 */
import type { ToolAction } from "./types";
import { isStringArray } from "./util";

type EmitImageFileAction = { type: "emit_image_file"; params: { path: string[]; prompt: string; mime: string } };

export const emit_image_file: ToolAction<EmitImageFileAction> = {
  function: {
    type: "function",
    name: "emit_image_file",
    strict: true,
    description: "Create an image file at the given path using the supplied prompt.",
    parameters: {
      type: "object",
      description: "Parameters for fabricating an image file via provider.",
      properties: {
        path: {
          type: "array",
          description: "Target path segments from the root. Last segment is the filename including extension.",
          minItems: 1,
          items: { type: "string", description: "A single path segment (no slashes).", minLength: 1, pattern: "^[^/]+$" },
        },
        prompt: {
          type: "string",
          description: "Concise prompt describing the image to generate.",
          minLength: 1,
        },
        mime: {
          type: "string",
          description: "Desired image MIME type (e.g., image/png, image/jpeg).",
        },
      },
      required: ["path", "prompt", "mime"],
      additionalProperties: false,
    },
  },
  normalize: (params: Record<string, unknown>): EmitImageFileAction | undefined => {
    const path = isStringArray(params.path) ? params.path : undefined;
    const prompt = typeof params.prompt === "string" ? params.prompt : undefined;
    const mime = typeof params.mime === "string" ? params.mime : undefined;
    if (!path || !prompt || !mime) {
      return undefined;
    }
    return { type: "emit_image_file", params: { path, prompt, mime } };
  },
};

