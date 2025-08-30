/**
 * JSON Schemas for FS tool payloads (Ajv v6 compatible).
 */
export const CreateDirSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: { type: "array", items: { type: "string" } },
  },
} as const;

export const CreateFileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "content"],
  properties: {
    path: { type: "array", items: { type: "string" } },
    content: { type: "string" },
    mime: { type: "string" },
  },
} as const;

export const WriteFileSchema = CreateFileSchema;

export const RemoveEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: { type: "array", items: { type: "string" } },
  },
} as const;

export const MoveEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["from", "to"],
  properties: {
    from: { type: "array", items: { type: "string" } },
    to: { type: "array", items: { type: "string" } },
  },
} as const;

export const CopyEntrySchema = MoveEntrySchema;

export const EmitFsListingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["folder", "entries"],
  properties: {
    folder: { type: "array", items: { type: "string" } },
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "name"],
        properties: {
          kind: { type: "string", enum: ["dir", "file"] },
          name: { type: "string" },
          content: { type: "string" },
          mime: { type: "string" },
        },
      },
    },
  },
} as const;

export const EmitFileContentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "content"],
  properties: {
    path: { type: "array", items: { type: "string" } },
    content: { type: "string" },
    mime: { type: "string" },
  },
} as const;

