/**
 * @file Action: copy_entry
 */
import type { FsState } from "../../fakefs/state";
import { cloneEntry, ensureDir, getEntry } from "../../fakefs/state";
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

export type CopyEntryAction = {
  type: "copy_entry";
  params: { from: string[]; to: string[] };
};

export const copy_entry: ToolAction<CopyEntryAction> = {
  function: {
    type: "function",
    name: "copy_entry",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        from: { type: "array", items: { type: "string" } },
        to: { type: "array", items: { type: "string" } },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  normalize: (params: Record<string, unknown>): CopyEntryAction | undefined => {
    const from = isStringArray(params.from) ? params.from : undefined;
    const to = isStringArray(params.to) ? params.to : undefined;
    if (!from || !to) {
      return undefined;
    }
    return { type: "copy_entry", params: { from, to } };
  },
  apply: (state: FsState, action: CopyEntryAction) => {
    const src = getEntry(state, action.params.from);
    if (!src) {
      return false;
    }
    const dstParent = ensureDir(state, action.params.to.slice(0, -1));
    const dstName = action.params.to[action.params.to.length - 1]!;
    const cloned = cloneEntry(src);
    cloned.name = dstName;
    dstParent.children.set(dstName, cloned);
    return true;
  },
};
