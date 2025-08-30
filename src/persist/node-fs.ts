/**
 * @file Node.js filesystem persistence adapter (Bun/Node fs.promises)
 */
import { promises as fsp } from "node:fs";
import { join, dirname } from "node:path";
import type { PersistAdapter, PathParts, Stat } from "./types";

/**
 * Check if error is a Node.js system error with a code property.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error ? "code" in error : false;
}

/**
 * Wrap filesystem errors with more context.
 */
function wrapFsError(error: unknown, operation: string, path: string): Error {
  if (isNodeError(error)) {
    switch (error.code) {
      case "EACCES":
      case "EPERM":
        return new Error(`Permission denied: ${operation} '${path}'`);
      case "ENOENT":
        return new Error(`File not found: ${operation} '${path}'`);
      case "ENOTDIR":
        return new Error(`Not a directory: ${operation} '${path}'`);
      case "EISDIR":
        return new Error(`Is a directory: ${operation} '${path}'`);
      case "ENOTEMPTY":
        return new Error(`Directory not empty: ${operation} '${path}'`);
      case "EEXIST":
        return new Error(`File already exists: ${operation} '${path}'`);
      case "EMFILE":
        return new Error(`Too many open files: ${operation} '${path}'`);
      case "ENOSPC":
        return new Error(`No space left on device: ${operation} '${path}'`);
      default:
        return new Error(`${operation} failed for '${path}': ${error.message}`);
    }
  }
  if (error instanceof Error) {
    return new Error(`${operation} failed for '${path}': ${error.message}`);
  }
  return new Error(`${operation} failed for '${path}': Unknown error`);
}

/**
 * Creates a Node.js filesystem implementation of PersistAdapter using fs.promises.
 */
export function createNodeFsAdapter(rootDir: string): PersistAdapter {
  const pathFor = (parts: PathParts): string => {
    const rest = parts.filter((p) => p !== "" && p !== "/");
    return join(rootDir, ...rest);
  };

  const ensureDir = async (path: PathParts): Promise<void> => {
    const p = pathFor(path);
    try {
      await fsp.mkdir(p, { recursive: true });
    } catch (error) {
      throw wrapFsError(error, "create directory", p);
    }
  };

  const readdir = async (path: PathParts): Promise<string[]> => {
    const p = pathFor(path);
    try {
      const list = await fsp.readdir(p, { withFileTypes: true });
      return list.map((d) => d.name);
    } catch (error) {
      throw wrapFsError(error, "read directory", p);
    }
  };

  const stat = async (path: PathParts): Promise<Stat> => {
    const p = pathFor(path);
    try {
      const s = await fsp.stat(p);
      return { 
        type: s.isDirectory() ? "dir" : "file", 
        size: s.isFile() ? s.size : undefined, 
        mtime: s.mtime.toISOString?.() ?? new Date(s.mtimeMs).toISOString() 
      };
    } catch (error) {
      throw wrapFsError(error, "stat", p);
    }
  };

  const exists = async (path: PathParts): Promise<boolean> => {
    const p = pathFor(path);
    try {
      await fsp.access(p);
      return true;
    } catch (error) {
      // For exists, we only return false for ENOENT, other errors should be thrown
      if (isNodeError(error) && error.code === "ENOENT") {
        return false;
      }
      // Permission errors and other issues should be reported
      if (isNodeError(error) && (error.code === "EACCES" || error.code === "EPERM")) {
        throw wrapFsError(error, "access", p);
      }
      // For other errors, we assume the file doesn't exist
      return false;
    }
  };

  const readFile = async (path: PathParts): Promise<Uint8Array> => {
    const p = pathFor(path);
    try {
      const buf = await fsp.readFile(p);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch (error) {
      throw wrapFsError(error, "read file", p);
    }
  };

  const writeFile = async (path: PathParts, data: Uint8Array): Promise<void> => {
    const p = pathFor(path);
    const dir = dirname(p);
    
    try {
      await fsp.mkdir(dir, { recursive: true });
    } catch (error) {
      throw wrapFsError(error, "create parent directory", dir);
    }
    
    try {
      await fsp.writeFile(p, Buffer.from(data));
    } catch (error) {
      throw wrapFsError(error, "write file", p);
    }
  };

  const remove = async (path: PathParts, opts?: { recursive?: boolean }): Promise<void> => {
    const p = pathFor(path);
    // Check if the file/directory exists
    const s = await fsp.stat(p).catch((error) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return undefined;
      }
      throw wrapFsError(error, "stat for remove", p);
    });
    if (!s) { return; }
    try {
      if (s.isDirectory()) {
        await fsp.rm(p, { recursive: opts?.recursive ?? true, force: true });
      } else {
        await fsp.unlink(p);
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw wrapFsError(error, "remove", p);
      }
    }
  };

  const move = async (from: PathParts, to: PathParts): Promise<void> => {
    const src = pathFor(from);
    const dst = pathFor(to);
    const dstDir = dirname(dst);
    
    try {
      await fsp.mkdir(dstDir, { recursive: true });
    } catch (error) {
      throw wrapFsError(error, "create destination directory", dstDir);
    }
    
    try {
      await fsp.rename(src, dst);
    } catch (error) {
      throw wrapFsError(error, `move from '${src}' to`, dst);
    }
  };

  const copy = async (from: PathParts, to: PathParts): Promise<void> => {
    const src = pathFor(from);
    const dst = pathFor(to);
    const dstDir = dirname(dst);
    
    try {
      await fsp.mkdir(dstDir, { recursive: true });
    } catch (error) {
      throw wrapFsError(error, "create destination directory", dstDir);
    }
    
    // Get source stats
    const s = await fsp.stat(src).catch((error) => { throw wrapFsError(error, "stat source for copy", src); });
    
    if (s.isDirectory()) {
      // Create destination directory
      try {
        await fsp.mkdir(dst, { recursive: true });
      } catch (error) {
        throw wrapFsError(error, "create destination directory", dst);
      }
      
      // Read source directory entries
      const entries = await fsp.readdir(src, { withFileTypes: true }).catch((error) => {
        throw wrapFsError(error, "read source directory", src);
      });
      
      // Copy each entry
      for (const e of entries) {
        const sp = join(src, e.name);
        const dp = join(dst, e.name);
        if (e.isDirectory()) {
          await copy([...from, e.name], [...to, e.name]);
        } else {
          try {
            const buf = await fsp.readFile(sp);
            await fsp.writeFile(dp, buf);
          } catch (error) {
            throw wrapFsError(error, `copy file from '${sp}' to`, dp);
          }
        }
      }
    } else {
      // Copy single file
      try {
        const buf = await fsp.readFile(src);
        await fsp.writeFile(dst, buf);
      } catch (error) {
        throw wrapFsError(error, `copy file from '${src}' to`, dst);
      }
    }
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
export const NodeFsAdapter = createNodeFsAdapter;
