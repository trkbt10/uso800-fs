/**
 * @file Utilities to deterministically generate directory listings and file contents from folder names.
 */
import type { FsState } from "./state";
import { ensureDir, putFile } from "./state";

function hash(s: string): number {
  const start = 2166136261 >>> 0;
  const acc = Array.from(s).reduce((h, ch) => {
    const v = h ^ ch.charCodeAt(0);
    return Math.imul(v, 16777619) >>> 0;
  }, start);
  return acc >>> 0;
}

function randInt(seed: number, min: number, max: number): number {
  // xorshift32 without let: sequence of consts
  const x1 = seed | 0;
  const x2 = (x1 ^ (x1 << 13)) | 0;
  const x3 = (x2 ^ (x2 >>> 17)) | 0;
  const x4 = (x3 ^ (x3 << 5)) >>> 0;
  const u = x4 / 0xffffffff;
  return Math.floor(min + u * (max - min + 1));
}

/**
 * Generates deterministic dummy subdirectories and files under the given path.
 * It does not overwrite existing entries; it only creates missing ones.
 *
 * @param state In-memory virtual filesystem state
 * @param folderPath Path segments from the root
 */
export function generateListingForFolder(state: FsState, folderPath: string[]): void {
  const name = folderPath[folderPath.length - 1] ?? "seed";
  const seed = hash(name);
  const dir = ensureDir(state, folderPath);
  const nFiles = randInt(seed, 2, 5);
  const nDirs = randInt(seed ^ 0x9e3779b9, 1, 3);

  // Create subdirs
  Array.from({ length: nDirs }).forEach((_, i) => {
    ensureDir(state, [...folderPath, `myst_${i + 1}`]);
  });

  // Create files with placeholder content (if missing)
  Array.from({ length: nFiles }).forEach((_, i) => {
    const fileName = `${name}_${i + 1}.txt`;
    if (!dir.children.has(fileName)) {
      const content = `This is a fabricated file for seed '${name}'. Index=${i + 1}`;
      putFile(state, [...folderPath, fileName], content, "text/plain");
    }
  });
}

/**
 * Returns deterministic placeholder text content derived from the given path.
 *
 * @param seedPath Path segments used as the content seed
 * @returns Generated placeholder content string
 */
export function fabricateFileContent(seedPath: string[]): string {
  const joinedPath = seedPath.join("/");
  const base = joinedPath !== "" ? joinedPath : "/";
  const h = hash(base);
  const count = (h % 5) + 3;
  const lines = [
    `# Uso800FS content for ${base}`,
    "",
    ...Array.from({ length: count }).map((_, i) => `- Line ${i + 1}: ${((h >> (i + 1)) & 0xffff).toString(16)}`),
    "",
    "This content is a deliberate fabrication.",
  ];
  return lines.join("\n");
}
