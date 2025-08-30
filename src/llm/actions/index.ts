/**
 * @file Aggregator: single mapを使って合成し、型を辞書から導出。
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

// 正規化後アクション型の抽出
type ActionFrom<T> = T extends { normalize: (p: Record<string, unknown>) => infer A }
  ? NonNullable<A>
  : never;

/**
 * function.name をキーにした辞書（単一の合成ポイント）。
 */
const actionsByName = {
  [create_dir.function.name]: create_dir,
  [create_file.function.name]: create_file,
  [write_file.function.name]: write_file,
  [remove_entry.function.name]: remove_entry,
  [move_entry.function.name]: move_entry,
  [copy_entry.function.name]: copy_entry,
  [emit_fs_listing.function.name]: emit_fs_listing,
  [emit_file_content.function.name]: emit_file_content,
} as const;

export type ToolName = keyof typeof actionsByName;
export type ToolSpec = (typeof actionsByName)[ToolName]["function"];
export type ToolAction = ActionFrom<(typeof actionsByName)[ToolName]>;

/** True when the provided string is a supported tool name. */
export function isToolName(x: string): x is ToolName {
  return x in actionsByName;
}

/** Builds the tool spec list for agent initialization. */
export function getOpenAIToolsSpec(): ToolSpec[] {
  return Object.values(actionsByName).map((a) => a.function);
}

/** Normalizes raw function_call inputs into a typed ToolAction. */
export function normalizeAction(name: string, params: Record<string, unknown>): ToolAction | undefined {
  if (!isToolName(name)) {
    return undefined;
  }
  const impl = actionsByName[name];
  return impl.normalize(params) as ToolAction | undefined;
}

/** Applies a ToolAction to the FsState (pure reducer). */
export function reduceFs(state: FsState, action: ToolAction): string | void | boolean {
  const impl = actionsByName[action.type as ToolName];
  if (!impl) {
    return undefined;
  }
  return impl.apply(state, action as never);
}
