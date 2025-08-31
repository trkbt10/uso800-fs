/**
 * @file Common action type definitions (no backend coupling).
 */

export type ToolSpecFor<Name extends string> = {
  type: "function";
  name: Name;
  strict: true;
  description?: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
    description?: string;
  };
};

export type ToolAction<A extends { type: string }> = {
  function: ToolSpecFor<A["type"]>;
  normalize: (params: Record<string, unknown>) => A | undefined;
};
