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
    
    let current = root;
    for (const part of parts) {
      if (!part || current.type !== "dir" || !current.children) {
        return undefined;
      }
      const next = current.children.get(part);
      if (!next) {
        return undefined;
      }
      current = next;
    }
    return current;
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

      let current = root;
      for (const part of path) {
        if (!part) continue;
        
        if (!current.children) {
          current.children = new Map();
        }
        
        let next = current.children.get(part);
        if (!next) {
          next = {
            type: "dir",
            mtime: new Date().toISOString(),
            children: new Map(),
          };
          current.children.set(part, next);
        } else if (next.type !== "dir") {
          throw new Error(`Path component is not a directory: ${part}`);
        }
        current = next;
      }
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
      return entry.content || new Uint8Array();
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
      
      if (entry.type === "dir" && entry.children && entry.children.size > 0 && !opts?.recursive) {
        throw new Error(`Directory not empty: /${path.join("/")}`);
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