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

export class MemoryAdapter implements PersistAdapter {
  private root: Node = { type: "dir", name: "/", children: new Map(), mtime: nowIso() };

  private walk(parts: PathParts): Node | undefined {
    let cur: Node = this.root;
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
  }

  async ensureDir(path: PathParts): Promise<void> {
    let cur: Node = this.root;
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
  }

  async readdir(path: PathParts): Promise<string[]> {
    const dir = this.walk(path);
    if (!dir || dir.type !== "dir") {
      throw new Error("not a directory");
    }
    return Array.from(dir.children.keys());
  }

  async stat(path: PathParts): Promise<Stat> {
    const node = this.walk(path);
    if (!node) {
      throw new Error("not found");
    }
    if (node.type === "dir") {
      return { type: "dir", mtime: node.mtime };
    }
    return { type: "file", size: node.data.byteLength, mtime: node.mtime };
  }

  async exists(path: PathParts): Promise<boolean> {
    return typeof this.walk(path) !== "undefined";
  }

  async readFile(path: PathParts): Promise<Uint8Array> {
    const node = this.walk(path);
    if (!node || node.type !== "file") {
      throw new Error("not a file");
    }
    return node.data;
  }

  async writeFile(path: PathParts, data: Uint8Array): Promise<void> {
    const parent = this.walk(path.slice(0, -1));
    if (!parent || parent.type !== "dir") {
      await this.ensureDir(path.slice(0, -1));
    }
    const dir = this.walk(path.slice(0, -1));
    if (!dir || dir.type !== "dir") {
      throw new Error("parent missing");
    }
    const name = path[path.length - 1] ?? "file";
    const f: Node = { type: "file", name, data, mtime: nowIso() };
    dir.children.set(name, f);
  }

  async remove(path: PathParts): Promise<void> {
    const parent = this.walk(path.slice(0, -1));
    if (!parent || parent.type !== "dir") {
      throw new Error("parent missing");
    }
    parent.children.delete(path[path.length - 1] ?? "");
  }

  async move(from: PathParts, to: PathParts): Promise<void> {
    const srcParent = this.walk(from.slice(0, -1));
    if (!srcParent || srcParent.type !== "dir") {
      throw new Error("source parent missing");
    }
    const node = srcParent.children.get(from[from.length - 1] ?? "");
    if (!node) {
      throw new Error("source missing");
    }
    srcParent.children.delete(from[from.length - 1] ?? "");
    await this.ensureDir(to.slice(0, -1));
    const dstParent = this.walk(to.slice(0, -1));
    if (!dstParent || dstParent.type !== "dir") {
      throw new Error("dest parent missing");
    }
    const renamed = node.type === "dir" ? { ...node, name: to[to.length - 1] ?? node.name } : { ...node, name: to[to.length - 1] ?? node.name };
    dstParent.children.set(renamed.name, renamed);
  }

  private clone(node: Node): Node {
    if (node.type === "dir") {
      const m = new Map<string, Node>();
      for (const [k, v] of node.children.entries()) {
        m.set(k, this.clone(v));
      }
      return { type: "dir", name: node.name, children: m, mtime: node.mtime };
    }
    return { type: "file", name: node.name, data: node.data.slice(), mime: node.mime, mtime: node.mtime };
  }

  async copy(from: PathParts, to: PathParts): Promise<void> {
    const node = this.walk(from);
    if (!node) {
      throw new Error("source missing");
    }
    await this.ensureDir(to.slice(0, -1));
    const dstParent = this.walk(to.slice(0, -1));
    if (!dstParent || dstParent.type !== "dir") {
      throw new Error("dest parent missing");
    }
    const name = to[to.length - 1] ?? (node.name || "entry");
    const cloned = this.clone(node);
    // rename root
    if (cloned.type === "dir") cloned.name = name; else cloned.name = name;
    dstParent.children.set(name, cloned);
  }
}

