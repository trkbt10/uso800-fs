/**
 * @file Action: emit_file_content
 */
import type { FsState } from "../../fakefs/state";
import { putFile } from "../../fakefs/state";
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

type EmitFileContentAction = { type: "emit_file_content"; params: { path: string[]; content: string; mime?: string } };

export const emit_file_content: ToolAction<EmitFileContentAction> = {
  function: { type: "function", name: "emit_file_content", strict: true },
  normalize: (params: Record<string, unknown>): EmitFileContentAction | undefined => {
    const path = isStringArray(params.path) ? params.path : undefined;
    const content = typeof params.content === "string" ? params.content : undefined;
    const mime = typeof params.mime === "string" ? params.mime : undefined;
    if (!path || typeof content !== "string") {
      return undefined;
    }
    return { type: "emit_file_content", params: { path, content, mime } };
  },
  apply: (state: FsState, action: EmitFileContentAction) => {
    const { path, content, mime } = action.params;
    putFile(state, path, content, mime);
    return content;
  },
};

