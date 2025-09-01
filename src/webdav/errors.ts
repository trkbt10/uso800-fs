/**
 * @file Error mapping for filesystem/protocol failures to WebDAV statuses.
 */

export type MappedError = { status: number; message?: string };

/**
 * Map an arbitrary error to a WebDAV HTTP status and optional message.
 * This normalizes known fs-like error message patterns.
 */
export function mapErrorToDav(err: unknown): MappedError {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (lower.includes("permission denied")) { return { status: 403, message: msg }; }
  if (lower.includes("not a directory")) { return { status: 409, message: msg }; }
  if (lower.includes("is a directory")) { return { status: 409, message: msg }; }
  if (lower.includes("directory not empty")) { return { status: 409, message: msg }; }
  if (lower.includes("file not found") || lower.includes("not found")) { return { status: 404, message: msg }; }
  if (lower.includes("already exists")) { return { status: 412, message: msg }; }
  return { status: 500, message: msg };
}

