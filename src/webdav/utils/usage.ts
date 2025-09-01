/**
 * @file Utility to compute total used bytes under a path.
 */
import type { PersistAdapter, Stat } from "../persist/types";

async function statSafe(persist: PersistAdapter, parts: string[]): Promise<Stat | null> {
  try { return await persist.stat(parts); } catch { return null; }
}

/**
 * Computes the total size (in bytes) of all files under the given path.
 * Superficially, this looks like a simple stat; in practice it recursively
 * traverses directories to sum sizes, returning 0 when nodes are missing.
 */
export async function computeUsedBytes(persist: PersistAdapter, parts: string[]): Promise<number> {
  const st = await statSafe(persist, parts);
  if (!st) { return 0; }
  if (st.type === "file") { return st.size ?? 0; }
  const names = (await persist.readdir(parts).catch(() => []))
    .filter((n) => n !== "_dav");
  const sums = await Promise.all(names.map(async (n) => await computeUsedBytes(persist, [...parts, n])));
  return sums.reduce((a, b) => a + b, 0);
}
