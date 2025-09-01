/**
 * @file Tools entry (lean). Only the two creative tools are exposed.
 */
import { emit_fs_listing } from "./emit_fs_listing";
import { emit_file_content } from "./emit_file_content";
import { emit_image_file } from "./emit_image_file";

/**
 * Supported creative tools.
 */
export type ToolName = "emit_fs_listing" | "emit_file_content" | "emit_image_file";
export type ToolSpec = typeof emit_fs_listing.function | typeof emit_file_content.function | typeof emit_image_file.function;

export type EmitFsListing = ReturnType<typeof emit_fs_listing.normalize>;
export type EmitFileContent = ReturnType<typeof emit_file_content.normalize>;
export type EmitImageFile = ReturnType<typeof emit_image_file.normalize>;
export type ToolAction = NonNullable<EmitFsListing | EmitFileContent | EmitImageFile>;

/** Returns OpenAI-compatible tool specs used by the orchestrator. */
export function getOpenAIToolsSpec(): ToolSpec[] {
  return [emit_fs_listing.function, emit_file_content.function, emit_image_file.function];
}

/** Validates and normalizes tool-call args into a typed action. */
export function normalizeAction(name: string, params: Record<string, unknown>): ToolAction | undefined {
  if (name === "emit_fs_listing") {
    return emit_fs_listing.normalize(params) ?? undefined;
  }
  if (name === "emit_file_content") {
    return emit_file_content.normalize(params) ?? undefined;
  }
  if (name === "emit_image_file") {
    return emit_image_file.normalize(params) ?? undefined;
  }
  return undefined;
}
