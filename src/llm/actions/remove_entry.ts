/**
 * @file Action: remove_entry
 */
import type { FsState } from "../../fakefs/state";
import { removeEntry } from "../../fakefs/state";
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

type RemoveEntryAction = { type: "remove_entry"; params: { path: string[] } };

export const remove_entry: ToolAction<RemoveEntryAction> = {
  function: {
    type: "function",
    name: "remove_entry",
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
  normalize: (params: Record<string, unknown>): RemoveEntryAction | undefined => {
    const path = isStringArray(params.path) ? params.path : undefined;
    if (!path) {
      return undefined;
    }
    return { type: "remove_entry", params: { path } };
  },
  apply: (state: FsState, action: RemoveEntryAction) => {
    removeEntry(state, action.params.path);
  },
};
