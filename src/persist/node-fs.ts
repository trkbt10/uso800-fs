/**
 * @file Node.js filesystem persistence adapter (Bun/Node fs.promises)
 */
import { promises as fsp } from "node:fs";
import { join, dirname } from "node:path";
import type { PersistAdapter, PathParts, Stat } from "./types";

export class NodeFsAdapter implements PersistAdapter {
  constructor(private rootDir: string) {}

  private pathFor(parts: PathParts): string {
    const rest = parts.filter((p) => p && p !== "/");
    return join(this.rootDir, ...rest);
  }

  async ensureDir(path: PathParts): Promise<void> {
    const p = this.pathFor(path);
    await fsp.mkdir(p, { recursive: true });
  }

  async readdir(path: PathParts): Promise<string[]> {
    const p = this.pathFor(path);
    const list = await fsp.readdir(p, { withFileTypes: true });
    return list.map((d) => d.name);
  }

  async stat(path: PathParts): Promise<Stat> {
    const p = this.pathFor(path);
    const s = await fsp.stat(p);
    return { type: s.isDirectory() ? "dir" : "file", size: s.isFile() ? s.size : undefined, mtime: s.mtime.toISOString?.() ?? new Date(s.mtimeMs).toISOString() };
  }

  async exists(path: PathParts): Promise<boolean> {
    try {
      await fsp.access(this.pathFor(path));
      return true;
    } catch {
      return false;
    }
  }

  async readFile(path: PathParts): Promise<Uint8Array> {
    const p = this.pathFor(path);
    const buf = await fsp.readFile(p);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  async writeFile(path: PathParts, data: Uint8Array): Promise<void> {
    const p = this.pathFor(path);
    await fsp.mkdir(dirname(p), { recursive: true });
    await fsp.writeFile(p, Buffer.from(data));
  }

  async remove(path: PathParts, opts?: { recursive?: boolean }): Promise<void> {
    const p = this.pathFor(path);
    const s = await fsp.stat(p).catch(() => undefined);
    if (!s) {
      return;
    }
    if (s.isDirectory()) {
      await fsp.rm(p, { recursive: opts?.recursive ?? true, force: true });
      return;
    }
    await fsp.unlink(p).catch(() => undefined);
  }

  async move(from: PathParts, to: PathParts): Promise<void> {
    const src = this.pathFor(from);
    const dst = this.pathFor(to);
    await fsp.mkdir(dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
  }

  async copy(from: PathParts, to: PathParts): Promise<void> {
    const src = this.pathFor(from);
    const dst = this.pathFor(to);
    await fsp.mkdir(dirname(dst), { recursive: true });
    // Recursive copy (file or directory)
    const s = await fsp.stat(src);
    if (s.isDirectory()) {
      // Manual recursive copy to keep compatibility
      const entries = await fsp.readdir(src, { withFileTypes: true });
      await fsp.mkdir(dst, { recursive: true });
      for (const e of entries) {
        const sp = join(src, e.name);
        const dp = join(dst, e.name);
        if (e.isDirectory()) {
          await this.copy([...from, e.name], [...to, e.name]);
        } else {
          const buf = await fsp.readFile(sp);
          await fsp.writeFile(dp, buf);
        }
      }
      return;
    }
    const buf = await fsp.readFile(src);
    await fsp.writeFile(dst, buf);
  }
}

