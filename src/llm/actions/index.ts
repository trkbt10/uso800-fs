/**
 * @file Aggregator: collects per-action single-export objects and exposes typed helpers.
 */
import type { FsState } from "../../fakefs/state";
import { create_dir } from "./create_dir";
import { create_file } from "./create_file";
import { write_file } from "./write_file";
import { remove_entry } from "./remove_entry";
import { move_entry } from "./move_entry";
import { copy_entry } from "./copy_entry";
import { emit_fs_listing } from "./emit_fs_listing";
import { emit_file_content } from "./emit_file_content";

type CreateDirAction = NonNullable<ReturnType<typeof create_dir.normalize>>;
type CreateFileAction = NonNullable<ReturnType<typeof create_file.normalize>>;
type WriteFileAction = NonNullable<ReturnType<typeof write_file.normalize>>;
type RemoveEntryAction = NonNullable<ReturnType<typeof remove_entry.normalize>>;
type MoveEntryAction = NonNullable<ReturnType<typeof move_entry.normalize>>;
type CopyEntryAction = NonNullable<ReturnType<typeof copy_entry.normalize>>;
type EmitFsListingAction = NonNullable<ReturnType<typeof emit_fs_listing.normalize>>;
type EmitFileContentAction = NonNullable<ReturnType<typeof emit_file_content.normalize>>;

export type ToolName =
  | typeof create_dir.function.name
  | typeof create_file.function.name
  | typeof write_file.function.name
  | typeof remove_entry.function.name
  | typeof move_entry.function.name
  | typeof copy_entry.function.name
  | typeof emit_fs_listing.function.name
  | typeof emit_file_content.function.name;

export type ToolAction =
  | CreateDirAction
  | CreateFileAction
  | WriteFileAction
  | RemoveEntryAction
  | MoveEntryAction
  | CopyEntryAction
  | EmitFsListingAction
  | EmitFileContentAction;

export type ToolSpec = typeof create_dir.function;

/** True when the provided string is a supported tool name. */
export function isToolName(x: string): x is ToolName {
  if (x === create_dir.function.name) {
    return true;
  }
  if (x === create_file.function.name) {
    return true;
  }
  if (x === write_file.function.name) {
    return true;
  }
  if (x === remove_entry.function.name) {
    return true;
  }
  if (x === move_entry.function.name) {
    return true;
  }
  if (x === copy_entry.function.name) {
    return true;
  }
  if (x === emit_fs_listing.function.name) {
    return true;
  }
  if (x === emit_file_content.function.name) {
    return true;
  }
  return false;
}

/** Builds the tool spec list for agent initialization. */
export function getOpenAIToolsSpec(): ToolSpec[] {
  return [
    create_dir.function,
    create_file.function,
    write_file.function,
    remove_entry.function,
    move_entry.function,
    copy_entry.function,
    emit_fs_listing.function,
    emit_file_content.function,
  ];
}

/** Normalizes raw function_call inputs into a typed ToolAction. */
export function normalizeAction(name: string, params: Record<string, unknown>): ToolAction | undefined {
  if (name === create_dir.function.name) {
    return create_dir.normalize(params);
  }
  if (name === create_file.function.name) {
    return create_file.normalize(params);
  }
  if (name === write_file.function.name) {
    return write_file.normalize(params);
  }
  if (name === remove_entry.function.name) {
    return remove_entry.normalize(params);
  }
  if (name === move_entry.function.name) {
    return move_entry.normalize(params);
  }
  if (name === copy_entry.function.name) {
    return copy_entry.normalize(params);
  }
  if (name === emit_fs_listing.function.name) {
    return emit_fs_listing.normalize(params);
  }
  if (name === emit_file_content.function.name) {
    return emit_file_content.normalize(params);
  }
  return undefined;
}

/** Applies a ToolAction to the FsState (pure reducer). */
export function reduceFs(state: FsState, action: ToolAction): string | void {
  if (action.type === create_dir.function.name) {
    return create_dir.apply(state, action as CreateDirAction);
  }
  if (action.type === create_file.function.name) {
    return create_file.apply(state, action as CreateFileAction);
  }
  if (action.type === write_file.function.name) {
    return write_file.apply(state, action as WriteFileAction);
  }
  if (action.type === remove_entry.function.name) {
    return remove_entry.apply(state, action as RemoveEntryAction);
  }
  if (action.type === move_entry.function.name) {
    return move_entry.apply(state, action as MoveEntryAction);
  }
  if (action.type === copy_entry.function.name) {
    return copy_entry.apply(state, action as CopyEntryAction);
  }
  if (action.type === emit_fs_listing.function.name) {
    return emit_fs_listing.apply(state, action as EmitFsListingAction);
  }
  if (action.type === emit_file_content.function.name) {
    return emit_file_content.apply(state, action as EmitFileContentAction);
  }
  return undefined;
}
