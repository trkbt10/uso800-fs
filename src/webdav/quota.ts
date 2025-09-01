/**
 * @file Basic QUOTA helpers: limit discovery and available-bytes computation.
 */
import type { PersistAdapter } from "./persist/types";
import { createDavStateStore } from "./dav-state";
import { computeUsedBytes } from "./utils/usage";

function parseLimit(val: unknown): number | null {
  if (typeof val !== "string") { return null; }
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) { return null; }
  return Math.floor(n);
}

/**
 * Reads global quota limit from props at root path ('/'): key `Z:quota-limit-bytes`.
 */
export async function getQuotaLimitBytes(persist: PersistAdapter): Promise<number | null> {
  const store = createDavStateStore(persist);
  const props = await store.getProps("/");
  const raw = (props as Record<string, unknown>)["Z:quota-limit-bytes"];
  return parseLimit(raw);
}

/**
 * Computes total used bytes across the entire store (root path).
 */
export async function getTotalUsedBytes(persist: PersistAdapter): Promise<number> {
  return await computeUsedBytes(persist, []);
}

/**
 * Computes available bytes given the configured limit. Returns null if no limit.
 */
export async function getAvailableBytes(persist: PersistAdapter): Promise<number | null> {
  const limit = await getQuotaLimitBytes(persist);
  if (limit === null) { return null; }
  const used = await getTotalUsedBytes(persist);
  const remaining = limit - used;
  return remaining > 0 ? remaining : 0;
}

