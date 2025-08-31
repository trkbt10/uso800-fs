/**
 * @file DataLoader-based PersistAdapter wrapper for batching and deduplication.
 */
import DataLoader from "dataloader";
import type { PersistAdapter, PathParts, Stat } from "./types";

type PathKey = string;

function keyOf(parts: PathParts): PathKey {
  if (!Array.isArray(parts)) {
    return "/";
  }
  return "/" + parts.filter((p) => { if (!p) { return false; } return p !== "/"; }).join("/");
}

/**
 * Creates a DataLoader-wrapped PersistAdapter that batches and deduplicates
 * read operations within the same tick/context.
 */
export function createDataLoaderAdapter(base: PersistAdapter): PersistAdapter {
  // Create separate DataLoaders for each read operation type
  // These will batch and deduplicate requests within the same tick
  
  const existsLoader = new DataLoader<PathKey, boolean>(async (keys) => {
    return Promise.all(keys.map(async (key) => {
      const parts = key === "/" ? [] : key.slice(1).split("/");
      return base.exists(parts);
    }));
  }, { cache: true });

  const statLoader = new DataLoader<PathKey, Stat | null>(async (keys) => {
    return Promise.all(keys.map(async (key) => {
      const parts = key === "/" ? [] : key.slice(1).split("/");
      try {
        return await base.stat(parts);
      } catch {
        return null;
      }
    }));
  }, { cache: true });

  const readdirLoader = new DataLoader<PathKey, string[]>(async (keys) => {
    return Promise.all(keys.map(async (key) => {
      const parts = key === "/" ? [] : key.slice(1).split("/");
      try {
        return await base.readdir(parts);
      } catch {
        return [];
      }
    }));
  }, { cache: true });

  const readFileLoader = new DataLoader<PathKey, Uint8Array | null>(async (keys) => {
    return Promise.all(keys.map(async (key) => {
      const parts = key === "/" ? [] : key.slice(1).split("/");
      try {
        return await base.readFile(parts);
      } catch {
        return null;
      }
    }));
  }, { cache: true });

  // For write operations, we need to clear relevant caches
  function clearCachesForPath(path: PathParts): void {
    const key = keyOf(path);
    existsLoader.clear(key);
    statLoader.clear(key);
    readFileLoader.clear(key);
    
    // Also clear parent directory's readdir cache
    if (Array.isArray(path) && path.length > 0) {
      const parentKey = keyOf(path.slice(0, -1));
      readdirLoader.clear(parentKey);
    }
  }

  function clearCachesForTree(): void {
    // Clear all caches when directory structure changes
    existsLoader.clearAll();
    statLoader.clearAll();
    readdirLoader.clearAll();
    readFileLoader.clearAll();
  }

  return {
    async exists(path: PathParts): Promise<boolean> {
      return existsLoader.load(keyOf(path));
    },

    async stat(path: PathParts): Promise<Stat> {
      const result = await statLoader.load(keyOf(path));
      if (!result) {
        throw new Error(`Path not found: ${keyOf(path)}`);
      }
      return result;
    },

    async readdir(path: PathParts): Promise<string[]> {
      return readdirLoader.load(keyOf(path));
    },

    async readFile(path: PathParts): Promise<Uint8Array> {
      const result = await readFileLoader.load(keyOf(path));
      if (!result) {
        throw new Error(`File not found: ${keyOf(path)}`);
      }
      return result;
    },

    async ensureDir(path: PathParts): Promise<void> {
      await base.ensureDir(path);
      clearCachesForPath(path);
    },

    async writeFile(path: PathParts, data: Uint8Array, mime?: string): Promise<void> {
      await base.writeFile(path, data, mime);
      clearCachesForPath(path);
    },

    async remove(path: PathParts, opts?: { recursive?: boolean }): Promise<void> {
      await base.remove(path, opts);
      if (opts?.recursive) {
        clearCachesForTree();
      } else {
        clearCachesForPath(path);
      }
    },

    async move(from: PathParts, to: PathParts): Promise<void> {
      await base.move(from, to);
      clearCachesForPath(from);
      clearCachesForPath(to);
    },

    async copy(from: PathParts, to: PathParts): Promise<void> {
      await base.copy(from, to);
      clearCachesForPath(to);
    },
  };
}
