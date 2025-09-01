/**
 * @file In-memory PersistAdapter implementation for non-persistent mode.
 */
import type { PersistAdapter, PathParts, Stat, EntryType } from "./types";

type MemoryEntry = {
  type: EntryType;
  content?: Uint8Array;
  mime?: string;
  mtime: string;
  children?: Map<string, MemoryEntry>;
};

/**
 * Creates an in-memory PersistAdapter that stores data only in memory.
 * All data is lost when the process exits.
 */
export function createMemoryAdapter(): PersistAdapter {
  const root: MemoryEntry = {
    type: "dir",
    mtime: new Date().toISOString(),
    children: new Map(),
  };

  function getEntry(parts: PathParts): MemoryEntry | undefined {
    if (!Array.isArray(parts) || parts.length === 0) {
      return root;
    }
    return parts.reduce<MemoryEntry | undefined>((node, part) => {
      if (!node || node.type !== "dir" || !node.children || !part) {
        return undefined;
      }
      return node.children.get(part);
    }, root as MemoryEntry | undefined);
  }

  function getParentAndName(parts: PathParts): { parent: MemoryEntry; name: string } | undefined {
    if (!Array.isArray(parts) || parts.length === 0) {
      return undefined;
    }
    
    const parentParts = parts.slice(0, -1);
    const name = parts[parts.length - 1];
    
    if (!name) {
      return undefined;
    }
    
    const parent = getEntry(parentParts);
    if (!parent || parent.type !== "dir") {
      return undefined;
    }
    
    return { parent, name };
  }

  return {
    async ensureDir(path: PathParts): Promise<void> {
      if (!Array.isArray(path) || path.length === 0) {
        return; // Root already exists
      }
      function ensureFrom(node: MemoryEntry, segments: readonly string[]): MemoryEntry {
        if (segments.length === 0) {
          return node;
        }
        const [head, ...tail] = segments;
        if (!head) {
          return ensureFrom(node, tail);
        }
        if (!node.children) {
          node.children = new Map();
        }
        const existing = node.children.get(head);
        if (!existing) {
          const next: MemoryEntry = { type: "dir", mtime: new Date().toISOString(), children: new Map() };
          node.children.set(head, next);
          return ensureFrom(next, tail);
        }
        if (existing.type !== "dir") {
          throw new Error(`Path component is not a directory: ${head}`);
        }
        return ensureFrom(existing, tail);
      }
      ensureFrom(root, path as string[]);
    },

    async readdir(path: PathParts): Promise<string[]> {
      const entry = getEntry(path);
      if (!entry) {
        throw new Error(`Directory not found: /${path.join("/")}`);
      }
      if (entry.type !== "dir" || !entry.children) {
        throw new Error(`Not a directory: /${path.join("/")}`);
      }
      return Array.from(entry.children.keys());
    },

    async stat(path: PathParts): Promise<Stat> {
      const entry = getEntry(path);
      if (!entry) {
        throw new Error(`Path not found: /${path.join("/")}`);
      }
      return {
        type: entry.type,
        size: entry.type === "file" ? entry.content?.length : undefined,
        mtime: entry.mtime,
        mime: entry.type === "file" ? entry.mime : undefined,
      };
    },

    async exists(path: PathParts): Promise<boolean> {
      return getEntry(path) !== undefined;
    },

    async readFile(path: PathParts): Promise<Uint8Array> {
      const entry = getEntry(path);
      if (!entry) {
        throw new Error(`File not found: /${path.join("/")}`);
      }
      if (entry.type !== "file") {
        throw new Error(`Not a file: /${path.join("/")}`);
      }
      return entry.content !== undefined ? entry.content : new Uint8Array();
    },

    async writeFile(path: PathParts, data: Uint8Array, mime?: string): Promise<void> {
      const info = getParentAndName(path);
      if (!info) {
        throw new Error(`Invalid path: /${path.join("/")}`);
      }
      
      const { parent, name } = info;
      if (!parent.children) {
        parent.children = new Map();
      }
      
      parent.children.set(name, {
        type: "file",
        content: data,
        mime,
        mtime: new Date().toISOString(),
      });
    },

    async remove(path: PathParts, opts?: { recursive?: boolean }): Promise<void> {
      const info = getParentAndName(path);
      if (!info) {
        throw new Error(`Invalid path: /${path.join("/")}`);
      }
      
      const { parent, name } = info;
      if (!parent.children) {
        return;
      }
      
      const entry = parent.children.get(name);
      if (!entry) {
        return;
      }
      
      if (entry.type === "dir") {
        const hasChildren = entry.children ? entry.children.size > 0 : false;
        const allowRecursive = opts ? Boolean(opts.recursive) : false;
        if (hasChildren && !allowRecursive) {
          throw new Error(`Directory not empty: /${path.join("/")}`);
        }
      }
      
      parent.children.delete(name);
    },

    async move(from: PathParts, to: PathParts): Promise<void> {
      const fromInfo = getParentAndName(from);
      const toInfo = getParentAndName(to);
      
      if (!fromInfo || !toInfo) {
        throw new Error("Invalid path");
      }
      
      const entry = fromInfo.parent.children?.get(fromInfo.name);
      if (!entry) {
        throw new Error(`Source not found: /${from.join("/")}`);
      }
      
      // Remove from old location
      fromInfo.parent.children?.delete(fromInfo.name);
      
      // Add to new location
      if (!toInfo.parent.children) {
        toInfo.parent.children = new Map();
      }
      toInfo.parent.children.set(toInfo.name, entry);
    },

    async copy(from: PathParts, to: PathParts): Promise<void> {
      const fromEntry = getEntry(from);
      const toInfo = getParentAndName(to);
      
      if (!fromEntry || !toInfo) {
        throw new Error("Invalid path");
      }
      
      // Deep clone the entry
      function cloneEntry(entry: MemoryEntry): MemoryEntry {
        if (entry.type === "file") {
          return {
            type: "file",
            content: entry.content ? new Uint8Array(entry.content) : undefined,
            mime: entry.mime,
            mtime: new Date().toISOString(),
          };
        } else {
          const newEntry: MemoryEntry = {
            type: "dir",
            mtime: new Date().toISOString(),
            children: new Map(),
          };
          if (entry.children) {
            for (const [name, child] of entry.children) {
              newEntry.children!.set(name, cloneEntry(child));
            }
          }
          return newEntry;
        }
      }
      
      if (!toInfo.parent.children) {
        toInfo.parent.children = new Map();
      }
      toInfo.parent.children.set(toInfo.name, cloneEntry(fromEntry));
    },
  };
}
