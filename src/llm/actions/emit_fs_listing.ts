/**
 * @file Action: emit_fs_listing
 */
import type { FsState } from "../../fakefs/state";
import { ensureDir, putFile } from "../../fakefs/state";
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
    parameters: {
      type: "object",
      properties: {
        folder: { type: "array", items: { type: "string" } },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["dir", "file"] },
              name: { type: "string" },
              content: { type: "string" },
              mime: { type: "string" },
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
  apply: (state: FsState, action: EmitFsListingAction) => {
    const { folder, entries } = action.params;
    ensureDir(state, folder);
    for (const e of entries) {
      if (e.kind === "dir") {
        ensureDir(state, [...folder, e.name]);
      } else {
        putFile(state, [...folder, e.name], e.content, e.mime);
      }
    }
  },
};
