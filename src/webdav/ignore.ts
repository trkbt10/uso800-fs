/**
 * @file Ignore helpers: glob -> RegExp, path ignore predicate, and filtered PersistAdapter.
 * What it looks like: a simple mapper from glob to RegExp and a boolean checker.
 * What it actually does: normalizes paths to POSIX style, safely escapes regex tokens,
 * restores glob tokens (for example: double-star segments, single-star, and question-mark),
 * and provides a filtered PersistAdapter that excludes ignored entries on readdir.
 * It also applies quick-path checks for common OS metadata files (e.g. .DS_Store, AppleDouble)
 * to avoid unnecessary regex work.
 */
import type { PersistAdapter, PathParts } from "./persist/types";

/**
 * Escapes special regex characters in a literal string, preserving meaning when
 * later interpolated into a RegExp. Prevents accidental character class or group creation.
 */
export function escapeRegExpLiteral(input: string): string {
  const parts: string[] = [];
  for (const ch of input) {
    switch (ch) {
      case "\\": parts.push("\\\\"); break;
      case ".": parts.push("\\."); break;
      case "+": parts.push("\\+"); break;
      case "*": parts.push("\\*"); break;
      case "?": parts.push("\\?"); break;
      case "^": parts.push("\\^"); break;
      case "$": parts.push("\\$"); break;
      case "(": parts.push("\\("); break;
      case ")": parts.push("\\)"); break;
      case "|": parts.push("\\|"); break;
      case "[": parts.push("\\["); break;
      case "]": parts.push("\\]"); break;
      default: parts.push(ch); break;
    }
  }
  return parts.join("");
}

/**
 * Converts a glob pattern to a RegExp.
 */
export function globToRegExp(glob: string): RegExp {
  // Normalize path to POSIX-style
  const g = glob.replace(/\\/g, "/");
  // Escape regex chars, then restore glob tokens
  const escaped = escapeRegExpLiteral(g);
  const re = escaped
    .replace(/\\\*\\\*\//g, "(?:.*/)?")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, "[^/]");
  return new RegExp(`^${re}$`);
}

/**
 * Builds default ignore RegExps plus user-provided globs.
 * Defaults include OS metadata and internal folders.
 */
export function buildIgnoreRegexps(globs?: string[]): RegExp[] {
  const defaults = [
    "**/._*",
    "**/.DS_Store",
    "**/.metadata_never_index*",
    "**/.localized",
    "**/Thumbs.db",
    "**/desktop.ini",
    "**/.Spotlight-V100",
    "**/.Trashes",
    "**/.fseventsd",
    "**/.AppleDouble",
    "**/.AppleDB",
    "**/.TemporaryItems",
    "**/.apDisk",
    "**/_dav",
    "**/_dav/**",
  ];
  const all = [...defaults, ...(globs ?? [])];
  return all.map((p) => globToRegExp(p));
}

/**
 * Creates a predicate that checks if a pathname should be ignored.
 * Applies quick short-circuits for known metadata files to reduce overhead.
 */
export function isIgnoredFactory(ignoreRes: RegExp[]) {
  return function isIgnored(pathname: string): boolean {
    const p = pathname.replace(/\\/g, "/");
    const parts = p.split("/").filter((s) => s);
    const base = parts[parts.length - 1] ?? "";
    // Quick defaults for common metadata/noise
    if (base === ".DS_Store") {
      return true;
    }
    if (base === "Thumbs.db") {
      return true;
    }
    if (base === "desktop.ini") {
      return true;
    }
    if (base === ".AppleDouble") {
      return true;
    }
    if (base === ".AppleDB") {
      return true;
    }
    if (base === ".TemporaryItems") {
      return true;
    }
    if (base === ".apDisk") {
      return true;
    }
    if (base.startsWith("._")) {
      return true;
    }
    for (const r of ignoreRes) {
      if (r.test(p)) {
        return true;
      }
      if (r.test(base)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Wraps a PersistAdapter to filter out ignored entries from readdir.
 * Note: it does not block readFile/stat calls; callers should check ignored paths earlier.
 */
export function createIgnoreFilteringAdapter(base: PersistAdapter, isIgnored: (p: string) => boolean): PersistAdapter {
  function isChildIgnored(dirParts: PathParts, name: string): boolean {
    const prefix = "/" + (dirParts.length > 0 ? dirParts.join("/") + "/" : "");
    const full = prefix + name;
    if (isIgnored(full)) {
      return true;
    }
    if (isIgnored(name)) {
      return true;
    }
    return false;
  }
  return {
    async exists(path) {
      return base.exists(path);
    },
    async stat(path) {
      return base.stat(path);
    },
    async readdir(path) {
      const names = await base.readdir(path);
      const dirParts = Array.isArray(path) ? (path as string[]) : [];
      return names.filter((n) => !isChildIgnored(dirParts, n));
    },
    async readFile(path) {
      return base.readFile(path);
    },
    async ensureDir(path) {
      return base.ensureDir(path);
    },
    async writeFile(path, data, mime) {
      return base.writeFile(path, data, mime);
    },
    async remove(path, opts) {
      return base.remove(path, opts);
    },
    async move(from, to) {
      return base.move(from, to);
    },
    async copy(from, to) {
      return base.copy(from, to);
    },
  };
}
