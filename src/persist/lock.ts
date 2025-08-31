/**
 * @file Per-path async lock wrapper for PersistAdapter to avoid duplicate concurrent operations.
 */
import type { PersistAdapter, PathParts } from "./types";

function isPathSegment(p: string): boolean {
  if (p === "") { return false; }
  if (p === "/") { return false; }
  return true;
}

function keyOf(parts: PathParts): string {
  if (!Array.isArray(parts)) {
    return "/";
  }
  const rest = parts.filter((p) => isPathSegment(p));
  return "/" + rest.join("/");
}

// Internal type was removed (no longer needed)

/**
 * Functional per-key lock manager supporting multi-key operations.
 * Uses a gate Promise placed for all keys before awaiting prior tails.
 */
function createPathLock() {
  const gates = new Map<string, Promise<void>>();
  function createGate(): { promise: Promise<void>; resolve: () => void } {
    const box: { promise?: Promise<void>; resolve?: () => void } = {};
    box.promise = new Promise<void>((resolve) => { box.resolve = resolve; });
    return { promise: box.promise!, resolve: box.resolve! };
  }

  async function withKeys(keys: string[], fn: () => Promise<void> | void): Promise<void> {
    const uniq = Array.from(new Set(keys)).sort();
    const prevs: Promise<void>[] = [];
    const gate = createGate();
    for (const k of uniq) {
      const prev = gates.get(k);
      if (prev) {
        prevs.push(prev);
      }
      gates.set(k, gate.promise);
    }
    await Promise.all(prevs);
    try {
      await fn();
    } finally {
      gate.resolve();
      // We intentionally keep resolved gates in the map to preserve ordering; no cleanup required.
    }
  }

  return { withKeys };
}

/**
 * Wraps a PersistAdapter with per-path locking on mutating operations.
 */
export function createLockedPersistAdapter(base: PersistAdapter): PersistAdapter {
  const lock = createPathLock();

  return {
    ensureDir: async (path) => lock.withKeys([keyOf(path)], () => base.ensureDir(path)),
    readdir: (path) => base.readdir(path),
    stat: (path) => base.stat(path),
    exists: (path) => base.exists(path),
    readFile: (path) => base.readFile(path),
    writeFile: async (path, data, mime) => lock.withKeys([keyOf(path)], () => base.writeFile(path, data, mime)),
    remove: async (path, opts) => lock.withKeys([keyOf(path)], () => base.remove(path, opts)),
    move: async (from, to) => lock.withKeys([keyOf(from), keyOf(to)], () => base.move(from, to)),
    copy: async (from, to) => lock.withKeys([keyOf(from), keyOf(to)], () => base.copy(from, to)),
  };
}
