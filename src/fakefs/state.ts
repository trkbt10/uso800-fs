/**
 * Virtual filesystem state and persistence utilities.
 */
export type FsEntry =
  | { type: "dir"; name: string; children: Map<string, FsEntry>; createdAt: string }
  | { type: "file"; name: string; size: number; content?: string; createdAt: string; mime?: string };

export type FsState = {
  root: FsEntry & { type: "dir" };
  lastNotice?: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function createFsState(): FsState {
  return { root: { type: "dir", name: "/", children: new Map(), createdAt: nowIso() } };
}

export function ensureDir(state: FsState, parts: string[]): FsEntry & { type: "dir" } {
  let cur = state.root;
  for (const p of parts) {
    if (!p) continue;
    const next = cur.children.get(p);
    if (!next) {
      const d: FsEntry & { type: "dir" } = { type: "dir", name: p, children: new Map(), createdAt: nowIso() };
      cur.children.set(p, d);
      cur = d;
      continue;
    }
    if (next.type !== "dir") {
      throw new Error(`Path segment ${p} is not a directory`);
    }
    cur = next;
  }
  return cur;
}

export function getEntry(state: FsState, parts: string[]): FsEntry | undefined {
  let cur: FsEntry = state.root;
  for (const p of parts) {
    if (!p) continue;
    if (cur.type !== "dir") return undefined;
    const next = cur.children.get(p);
    if (!next) return undefined;
    cur = next;
  }
  return cur;
}

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

export function removeEntry(state: FsState, parts: string[]): boolean {
  if (parts.length === 0) return false;
  const parent = ensureDir(state, parts.slice(0, -1));
  const name = parts[parts.length - 1]!;
  return parent.children.delete(name);
}

function cloneEntry(e: FsEntry): FsEntry {
  if (e.type === "dir") {
    const m = new Map<string, FsEntry>();
    for (const [k, v] of e.children.entries()) {
      m.set(k, cloneEntry(v));
    }
    return { type: "dir", name: e.name, createdAt: e.createdAt, children: m };
  }
  return { type: "file", name: e.name, size: e.size, content: e.content, createdAt: e.createdAt, mime: e.mime };
}

export function moveEntry(state: FsState, from: string[], to: string[]): boolean {
  if (from.length === 0 || to.length === 0) return false;
  const srcParent = ensureDir(state, from.slice(0, -1));
  const srcName = from[from.length - 1]!;
  const entry = srcParent.children.get(srcName);
  if (!entry) return false;
  const dstParent = ensureDir(state, to.slice(0, -1));
  const dstName = to[to.length - 1]!;
  srcParent.children.delete(srcName);
  // rename on place
  const renamed = entry.type === "dir" ? { ...entry, name: dstName } : { ...entry, name: dstName };
  dstParent.children.set(dstName, renamed);
  return true;
}

export function copyEntry(state: FsState, from: string[], to: string[]): boolean {
  const src = getEntry(state, from);
  if (!src) return false;
  const dstParent = ensureDir(state, to.slice(0, -1));
  const dstName = to[to.length - 1]!;
  const cloned = cloneEntry(src);
  if (cloned.type === "dir") cloned.name = dstName; else cloned.name = dstName;
  dstParent.children.set(dstName, cloned);
  return true;
}

// Persistence (JSON snapshot)
export type PlainEntry =
  | { type: "dir"; name: string; createdAt: string; children: Record<string, PlainEntry> }
  | { type: "file"; name: string; createdAt: string; size: number; content?: string; mime?: string };

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
