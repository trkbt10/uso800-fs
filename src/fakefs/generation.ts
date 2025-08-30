/**
 * Deterministic generation of directory listings and file contents from folder names.
 */
import type { FsEntry, FsState } from "./state";
import { ensureDir, putFile } from "./state";

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randInt(seed: number, min: number, max: number): number {
  // xorshift32
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = (x >>> 0) / 0xffffffff;
  return Math.floor(min + u * (max - min + 1));
}

export function generateListingForFolder(state: FsState, folderPath: string[]): void {
  const name = folderPath[folderPath.length - 1] ?? "seed";
  const seed = hash(name);
  const dir = ensureDir(state, folderPath);
  const nFiles = randInt(seed, 2, 5);
  const nDirs = randInt(seed ^ 0x9e3779b9, 1, 3);

  // Create subdirs
  for (let i = 0; i < nDirs; i += 1) {
    const sub = ensureDir(state, [...folderPath, `myst_${i + 1}`]);
    if (sub) {
      // noop
    }
  }

  // Create files with placeholder content (if missing)
  for (let i = 0; i < nFiles; i += 1) {
    const fileName = `${name}_${i + 1}.txt`;
    if (!dir.children.has(fileName)) {
      const content = `This is a fabricated file for seed '${name}'. Index=${i + 1}`;
      putFile(state, [...folderPath, fileName], content, "text/plain");
    }
  }
}

export function fabricateFileContent(seedPath: string[]): string {
  const base = seedPath.join("/") || "/";
  const h = hash(base);
  const lines: string[] = [];
  lines.push(`# Uso800FS content for ${base}`);
  lines.push("");
  const count = (h % 5) + 3;
  for (let i = 0; i < count; i += 1) {
    lines.push(`- Line ${i + 1}: ${((h >> (i + 1)) & 0xffff).toString(16)}`);
  }
  lines.push("");
  lines.push("This content is a deliberate fabrication.");
  return lines.join("\n");
}

