/**
 * @file Common action type pattern to keep per-action exports consistent.
 */
import type { FsState } from "../../fakefs/state";

export type ToolSpecFor<Name extends string> = {
  type: "function";
  name: Name;
  strict: true;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

export type ToolAction<A extends { type: string }> = {
  function: ToolSpecFor<A["type"]>;
  normalize: (params: Record<string, unknown>) => A | undefined;
  apply: (state: FsState, action: A) => string | void | boolean;
};
