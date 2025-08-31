/**
 * @file Action: move_entry
 */
import type { FsState } from "../../fakefs/state";
import { moveEntry } from "../../fakefs/state";
import { isStringArray } from "./util";
import type { ToolAction } from "./types";

type MoveEntryAction = { type: "move_entry"; params: { from: string[]; to: string[] } };

export const move_entry: ToolAction<MoveEntryAction> = {
  function: {
    type: "function",
    name: "move_entry",
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
  normalize: (params: Record<string, unknown>): MoveEntryAction | undefined => {
    const from = isStringArray(params.from) ? params.from : undefined;
    const to = isStringArray(params.to) ? params.to : undefined;
    if (!from || !to) {
      return undefined;
    }
    return { type: "move_entry", params: { from, to } };
  },
  apply: (state: FsState, action: MoveEntryAction) => {
    moveEntry(state, action.params.from, action.params.to);
  },
};
