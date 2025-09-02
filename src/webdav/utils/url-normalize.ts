/**
 * @file Small URL/path normalization helpers used by WebDAV handlers.
 */

/**
 * Extract a path from either an absolute URL or an absolute path string.
 * - If `value` is a full URL, returns its pathname.
 * - If `value` starts with '/', returns it as-is.
 * - Otherwise returns null.
 */
export function pathFromUrlOrAbsolute(value: string): string | null {
  try {
    const u = new URL(value);
    return u.pathname;
  } catch {
    if (value.startsWith("/")) {
      return value;
    }
    return null;
  }
}

