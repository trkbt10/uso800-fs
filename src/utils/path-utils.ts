/**
 * @file Path utilities for WebDAV and filesystem operations
 */

/**
 * Converts a URL path to filesystem path segments.
 */
export function pathToSegments(urlPath: string): string[] {
  return urlPath.split("/").filter((s) => s.length > 0);
}

/**
 * Converts filesystem path segments to a display path.
 */
export function segmentsToDisplayPath(segments: string[]): string {
  const joined = segments.join("/");
  return "/" + joined;
}

/**
 * Validates that segments don't contain invalid characters.
 */
export function validateSegments(segments: string[]): void {
  for (const segment of segments) {
    if (segment.includes("/")) { throw new Error(`Invalid path segment containing slash: "${segment}"`); }
    if (segment === "." || segment === "..") { throw new Error(`Invalid path segment: "${segment}"`); }
    if (segment === "") { throw new Error("Empty path segment not allowed"); }
  }
}

/**
 * Determines if a path represents the root directory.
 */
export function isRootPath(segments: string[]): boolean {
  return segments.length === 0;
}

