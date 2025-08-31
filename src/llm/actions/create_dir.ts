/**
 * @file Action: create_dir
 */
import type { FsState } from "../../fakefs/state";
import { ensureDir } from "../../fakefs/state";
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

type CreateDirAction = { type: "create_dir"; params: { path: string[] } };

export const create_dir: ToolAction<CreateDirAction> = {
  function: {
    type: "function",
    name: "create_dir",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "array", items: { type: "string" } },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  normalize: (params: Record<string, unknown>): CreateDirAction | undefined => {
    const path = isStringArray(params.path) ? params.path : undefined;
    if (!path) {
      return undefined;
    }
    return { type: "create_dir", params: { path } };
  },
  apply: (state: FsState, action: CreateDirAction) => {
    ensureDir(state, action.params.path);
  },
};
