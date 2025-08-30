/**
 * AJV validator for FS tool payloads.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Ajv v6 types may not be present
// @ts-ignore: ajv v6 compatible import
import Ajv from "ajv";
import {
  CreateDirSchema,
  CreateFileSchema,
  WriteFileSchema,
  RemoveEntrySchema,
  MoveEntrySchema,
  CopyEntrySchema,
  EmitFsListingSchema,
  EmitFileContentSchema,
} from "./schemas";

export type ToolName =
  | "create_dir"
  | "create_file"
  | "write_file"
  | "remove_entry"
  | "move_entry"
  | "copy_entry"
  | "emit_fs_listing"
  | "emit_file_content";

const ajv = new Ajv({ allErrors: true, useDefaults: true });

const validators: Record<ToolName, (data: unknown) => boolean> = {
  create_dir: ajv.compile(CreateDirSchema),
  create_file: ajv.compile(CreateFileSchema),
  write_file: ajv.compile(WriteFileSchema),
  remove_entry: ajv.compile(RemoveEntrySchema),
  move_entry: ajv.compile(MoveEntrySchema),
  copy_entry: ajv.compile(CopyEntrySchema),
  emit_fs_listing: ajv.compile(EmitFsListingSchema),
  emit_file_content: ajv.compile(EmitFileContentSchema),
};

export function validateToolPayload(name: ToolName, data: unknown): { ok: true } | { ok: false; errors: unknown } {
  const v = validators[name];
  if (!v) return { ok: false, errors: `unknown tool: ${name}` };
  const ok = v(data);
  if (ok) return { ok: true };
  return { ok: false, errors: (v as unknown as { errors?: unknown }).errors };
}

