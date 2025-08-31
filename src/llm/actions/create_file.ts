/**
 * @file Action: create_file
 */
import type { FsState } from "../../fakefs/state";
import { putFile } from "../../fakefs/state";
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

type CreateFileAction = { type: "create_file"; params: { path: string[]; content: string; mime: string } };

export const create_file: ToolAction<CreateFileAction> = {
  function: {
    type: "function",
    name: "create_file",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "array", items: { type: "string" } },
        content: { type: "string" },
        mime: { type: "string" },
      },
      required: ["path", "content", "mime"],
      additionalProperties: false,
    },
  },
  normalize: (params: Record<string, unknown>): CreateFileAction | undefined => {
    const path = isStringArray(params.path) ? params.path : undefined;
    const content = typeof params.content === "string" ? params.content : undefined;
    const mime = typeof params.mime === "string" ? params.mime : undefined;
    if (!path || typeof content !== "string" || typeof mime !== "string") {
      return undefined;
    }
    return { type: "create_file", params: { path, content, mime } };
  },
  apply: (state: FsState, action: CreateFileAction) => {
    const { path, content, mime } = action.params;
    putFile(state, path, content, mime);
  },
};
