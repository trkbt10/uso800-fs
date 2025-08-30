/**
 * @file In-memory persistence adapter.
 */
import type { PersistAdapter, PathParts, Stat } from "./types";

type Node =
  | { type: "dir"; name: string; children: Map<string, Node>; mtime: string }
  | { type: "file"; name: string; data: Uint8Array; mime?: string; mtime: string };

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Creates an in-memory implementation of PersistAdapter for testing and temporary storage.
 */
export function createMemoryAdapter(): PersistAdapter {
  const root: Node = { type: "dir", name: "/", children: new Map(), mtime: nowIso() };

  const walk = (parts: PathParts): Node | undefined => {
    // eslint-disable-next-line no-restricted-syntax -- Mutation needed for iterative tree traversal
    let cur: Node = root;
    for (const p of parts) {
      if (!p) {
        continue;
      }
      if (cur.type !== "dir") {
        return undefined;
      }
      const next = cur.children.get(p);
      if (!next) {
        return undefined;
      }
      cur = next;
    }
    return cur;
  };

  const ensureDir = async (path: PathParts): Promise<void> => {
    // eslint-disable-next-line no-restricted-syntax -- Mutation needed for iterative directory creation
    let cur: Node = root;
    for (const p of path) {
      if (!p) {
        continue;
      }
      if (cur.type !== "dir") {
        throw new Error("parent is not a directory");
      }
      const next = cur.children.get(p);
      if (!next) {
        const d: Node = { type: "dir", name: p, children: new Map(), mtime: nowIso() };
        cur.children.set(p, d);
        cur = d;
        continue;
      }
      cur = next;
    }
  };

  const readdir = async (path: PathParts): Promise<string[]> => {
    const dir = walk(path);
    if (!dir || dir.type !== "dir") {
      throw new Error("not a directory");
    }
    return Array.from(dir.children.keys());
  };

  const stat = async (path: PathParts): Promise<Stat> => {
    const node = walk(path);
    if (!node) {
      throw new Error("not found");
    }
    if (node.type === "dir") {
      return { type: "dir", mtime: node.mtime };
    }
    return { type: "file", size: node.data.byteLength, mtime: node.mtime };
  };

  const exists = async (path: PathParts): Promise<boolean> => {
    return typeof walk(path) !== "undefined";
  };

  const readFile = async (path: PathParts): Promise<Uint8Array> => {
    const node = walk(path);
    if (!node || node.type !== "file") {
      throw new Error("not a file");
    }
    return node.data;
  };

  const writeFile = async (path: PathParts, data: Uint8Array): Promise<void> => {
    const parent = walk(path.slice(0, -1));
    if (!parent || parent.type !== "dir") {
      await ensureDir(path.slice(0, -1));
    }
    const dir = walk(path.slice(0, -1));
    if (!dir || dir.type !== "dir") {
      throw new Error("parent missing");
    }
    const name = path[path.length - 1] ?? "file";
    const f: Node = { type: "file", name, data, mtime: nowIso() };
    dir.children.set(name, f);
  };

  const remove = async (path: PathParts): Promise<void> => {
    const parent = walk(path.slice(0, -1));
    if (!parent || parent.type !== "dir") {
      throw new Error("parent missing");
    }
    parent.children.delete(path[path.length - 1] ?? "");
  };

  const clone = (node: Node): Node => {
    if (node.type === "dir") {
      const m = new Map<string, Node>();
      for (const [k, v] of node.children.entries()) {
        m.set(k, clone(v));
      }
      return { type: "dir", name: node.name, children: m, mtime: node.mtime };
    }
    return { type: "file", name: node.name, data: node.data.slice(), mime: node.mime, mtime: node.mtime };
  };

  const move = async (from: PathParts, to: PathParts): Promise<void> => {
    const srcParent = walk(from.slice(0, -1));
    if (!srcParent || srcParent.type !== "dir") {
      throw new Error("source parent missing");
    }
    const node = srcParent.children.get(from[from.length - 1] ?? "");
    if (!node) {
      throw new Error("source missing");
    }
    srcParent.children.delete(from[from.length - 1] ?? "");
    await ensureDir(to.slice(0, -1));
    const dstParent = walk(to.slice(0, -1));
    if (!dstParent || dstParent.type !== "dir") {
      throw new Error("dest parent missing");
    }
    const newName = to[to.length - 1] ?? node.name;
    const renamed = { ...node, name: newName };
    dstParent.children.set(renamed.name, renamed);
  };

  const copy = async (from: PathParts, to: PathParts): Promise<void> => {
    const node = walk(from);
    if (!node) {
      throw new Error("source missing");
    }
    await ensureDir(to.slice(0, -1));
    const dstParent = walk(to.slice(0, -1));
    if (!dstParent || dstParent.type !== "dir") {
      throw new Error("dest parent missing");
    }
    const lastSegment = to[to.length - 1];
    const nodeName = node.name !== "" ? node.name : "entry";
    const name = lastSegment ?? nodeName;
    const cloned = clone(node);
    // rename root
    if (cloned.type === "dir") {
      cloned.name = name;
    } else {
      cloned.name = name;
    }
    dstParent.children.set(name, cloned);
  };

  return {
    ensureDir,
    readdir,
    stat,
    exists,
    readFile,
    writeFile,
    remove,
    move,
    copy,
  };
}

// For backward compatibility
export const MemoryAdapter = createMemoryAdapter;