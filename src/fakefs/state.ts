/**
 * @file In-memory virtual filesystem and its snapshot/restore utilities.
 */
export type FsEntry =
  | { type: "dir"; name: string; children: Map<string, FsEntry>; createdAt: string }
  | { type: "file"; name: string; size: number; content?: string; createdAt: string; mime?: string };

export type FsState = {
  root: FsEntry & { type: "dir" };
  lastNotice?: string;
};

/**
 * Returns the current time as an ISO 8601 string.
 * @returns ISO 8601 formatted string
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Creates an empty filesystem state.
 * @returns Initialized `FsState`
 */
export function createFsState(): FsState {
  return { root: { type: "dir", name: "/", children: new Map(), createdAt: nowIso() } };
}

/**
 * Ensures a directory exists at the given path, creating it if missing.
 *
 * @param state Filesystem state
 * @param parts Path segments from the root
 * @returns The directory entry
 * @throws If a non-directory entry exists along the path
 */
export function ensureDir(state: FsState, parts: string[]): FsEntry & { type: "dir" } {
  const recur = (node: FsEntry & { type: "dir" }, idx: number): FsEntry & { type: "dir" } => {
    if (idx >= parts.length) {
      return node;
    }
    const seg = parts[idx];
    if (!seg) {
      return recur(node, idx + 1);
    }
    const next = node.children.get(seg);
    if (!next) {
      const d: FsEntry & { type: "dir" } = { type: "dir", name: seg, children: new Map(), createdAt: nowIso() };
      node.children.set(seg, d);
      return recur(d, idx + 1);
    }
    if (next.type !== "dir") {
      throw new Error(`Path segment ${seg} is not a directory`);
    }
    return recur(next, idx + 1);
  };
  return recur(state.root, 0);
}

/**
 * Gets the entry (file or directory) at the given path.
 *
 * @param state Filesystem state
 * @param parts Path segments from the root
 * @returns The entry if found, otherwise `undefined`
 */
export function getEntry(state: FsState, parts: string[]): FsEntry | undefined {
  const recur = (node: FsEntry, idx: number): FsEntry | undefined => {
    if (idx >= parts.length) {
      return node;
    }
    const seg = parts[idx];
    if (!seg) {
      return recur(node, idx + 1);
    }
    if (node.type !== "dir") {
      return undefined;
    }
    const next = node.children.get(seg);
    if (!next) {
      return undefined;
    }
    return recur(next, idx + 1);
  };
  return recur(state.root, 0);
}

/**
 * Writes a file at the given path (creating it if missing).
 *
 * @param state Filesystem state
 * @param parts Path segments from the root (last segment is the filename)
 * @param content File content as a string
 * @param mime Optional MIME type
 * @returns The created or updated file entry
 */
export function putFile(state: FsState, parts: string[], content: string, mime?: string): FsEntry & { type: "file" } {
  const dir = ensureDir(state, parts.slice(0, -1));
  const name = parts[parts.length - 1] ?? "file";
  const data: FsEntry & { type: "file" } = {
    type: "file",
    name,
    size: new TextEncoder().encode(content).length,
    content,
    createdAt: nowIso(),
    mime,
  };
  dir.children.set(name, data);
  return data;
}

/**
 * Removes the entry at the given path.
 *
 * @param state Filesystem state
 * @param parts Path segments from the root
 * @returns `true` if the entry was removed
 */
export function removeEntry(state: FsState, parts: string[]): boolean {
  if (parts.length === 0) {
    return false;
  }
  const parent = ensureDir(state, parts.slice(0, -1));
  const name = parts[parts.length - 1]!;
  return parent.children.delete(name);
}

/**
 * Deep-clones an entry (directory or file).
 * @param e Source entry
 * @returns A newly cloned entry
 */
export function cloneEntry(e: FsEntry): FsEntry {
  if (e.type === "dir") {
    const m = new Map<string, FsEntry>();
    for (const [k, v] of e.children.entries()) {
      m.set(k, cloneEntry(v));
    }
    return { type: "dir", name: e.name, createdAt: e.createdAt, children: m };
  }
  return { type: "file", name: e.name, size: e.size, content: e.content, createdAt: e.createdAt, mime: e.mime };
}

/**
 * Moves (renames) an entry to another path.
 *
 * @param state Filesystem state
 * @param from Source path
 * @param to Destination path
 * @returns `true` on success, otherwise `false`
 */
export function moveEntry(state: FsState, from: string[], to: string[]): boolean {
  if (from.length === 0 || to.length === 0) {
    return false;
  }
  const srcParent = ensureDir(state, from.slice(0, -1));
  const srcName = from[from.length - 1]!;
  const entry = srcParent.children.get(srcName);
  if (!entry) {
    return false;
  }
  const dstParent = ensureDir(state, to.slice(0, -1));
  const dstName = to[to.length - 1]!;
  srcParent.children.delete(srcName);
  // rename on place
  const renamed = entry.type === "dir" ? { ...entry, name: dstName } : { ...entry, name: dstName };
  dstParent.children.set(dstName, renamed);
  return true;
}

/**
 * Copies an entry to another path.
 *
 * @param state Filesystem state
 * @param from Source path
 * @param to Destination path
 * @returns `true` on success, otherwise `false`
 */
export function copyEntry(state: FsState, from: string[], to: string[]): boolean {
  const src = getEntry(state, from);
  if (!src) {
    return false;
  }
  const dstParent = ensureDir(state, to.slice(0, -1));
  const dstName = to[to.length - 1]!;
  const cloned = cloneEntry(src);
  if (cloned.type === "dir") {
    cloned.name = dstName;
  } else {
    cloned.name = dstName;
  }
  dstParent.children.set(dstName, cloned);
  return true;
}

// Persistence (JSON snapshot)
export type PlainEntry =
  | { type: "dir"; name: string; createdAt: string; children: Record<string, PlainEntry> }
  | { type: "file"; name: string; createdAt: string; size: number; content?: string; mime?: string };

/**
 * Converts an entry into a serializable plain representation.
 * @param e Entry to convert
 * @returns Plain representation
 */
export function toPlain(e: FsEntry): PlainEntry {
  if (e.type === "dir") {
    const children: Record<string, PlainEntry> = {};
    for (const [k, v] of e.children.entries()) {
      children[k] = toPlain(v);
    }
    return { type: "dir", name: e.name, createdAt: e.createdAt, children };
  }
  return { type: "file", name: e.name, createdAt: e.createdAt, size: e.size, content: e.content, mime: e.mime };
}

/**
 * Restores an entry from its plain representation returned by `toPlain`.
 * @param e Plain representation
 * @returns Restored entry
 */
export function fromPlain(e: PlainEntry): FsEntry {
  if (e.type === "dir") {
    const m = new Map<string, FsEntry>();
    for (const k of Object.keys(e.children)) {
      m.set(k, fromPlain(e.children[k]!));
    }
    return { type: "dir", name: e.name, createdAt: e.createdAt, children: m };
  }
  return { type: "file", name: e.name, createdAt: e.createdAt, size: e.size, content: e.content, mime: e.mime };
}
