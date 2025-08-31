/**
 * @file Tools entry (lean). Only the two creative tools are exposed.
 */
import { emit_fs_listing } from "./emit_fs_listing";
import { emit_file_content } from "./emit_file_content";

export type ToolName = "emit_fs_listing" | "emit_file_content";
export type ToolSpec = typeof emit_fs_listing.function | typeof emit_file_content.function;

export type EmitFsListing = ReturnType<typeof emit_fs_listing.normalize>;
export type EmitFileContent = ReturnType<typeof emit_file_content.normalize>;
export type ToolAction = NonNullable<EmitFsListing | EmitFileContent>;

export function getOpenAIToolsSpec(): ToolSpec[] {
  return [emit_fs_listing.function, emit_file_content.function];
}

export function normalizeAction(name: string, params: Record<string, unknown>): ToolAction | undefined {
  if (name === "emit_fs_listing") {
    return emit_fs_listing.normalize(params) ?? undefined;
  }
  if (name === "emit_file_content") {
    return emit_file_content.normalize(params) ?? undefined;
  }
  return undefined;
}

