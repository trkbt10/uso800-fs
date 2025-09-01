/**
 * @file Small runtime guards for action normalization.
 */

/** True if v is string[]. */
export function isStringArray(v: unknown): v is string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return true;
  }
  return false;
}

/** Converts unknown value to typed entries array, filtering invalid items.
 * When kind is "file", both content and mime must be present (strings).
 * When kind is "dir", only name is required.
 */
export function toEntries(
  value: unknown,
): Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }> = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const kind = rec["kind"] ?? rec["type"];
      const name = rec["name"];
      if ((kind === "dir" || kind === "file") && typeof name === "string") {
        const contentVal = rec["content"];
        const mimeVal = rec["mime"];
        if (kind === "dir") {
          out.push({ kind, name, content: "", mime: "" });
        } else if (typeof contentVal === "string" && typeof mimeVal === "string") {
          out.push({ kind, name, content: contentVal, mime: mimeVal });
        }
      }
    }
  }
  return out;
}
