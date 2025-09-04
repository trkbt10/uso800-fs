/**
 * @file Simple collection order storage and helpers.
 */
import type { PersistAdapter } from "./persist/types";
import { createDavStateStore } from "./dav-state";

type OrderFile = { names: string[] };

function encodeKey(urlPath: string): string {
  const p = urlPath.startsWith("/") ? urlPath : "/" + urlPath;
  return Buffer.from(p).toString("base64url");
}

function orderPath(urlPath: string): string[] { return ["_dav", "order", encodeKey(urlPath) + ".json"]; }

async function readOrderFile(persist: PersistAdapter, urlPath: string): Promise<OrderFile> {
  const fp = orderPath(urlPath);
  const exists = await persist.exists(fp);
  if (!exists) { return { names: [] }; }
  try {
    const buf = await persist.readFile(fp);
    const txt = new TextDecoder().decode(buf);
    const val = JSON.parse(txt);
    if (typeof val === "object" && val !== null) {
      const names = Array.isArray((val as Record<string, unknown>).names) ? (val as Record<string, unknown>).names : [];
      const out = (names as unknown[]).map((x) => (typeof x === "string" ? x : "")).filter((s): s is string => s.length > 0);
      return { names: out };
    }
  } catch { /* ignore */ }
  return { names: [] };
}

async function writeOrderFile(persist: PersistAdapter, urlPath: string, order: OrderFile): Promise<void> {
  const fp = orderPath(urlPath);
  const dir = fp.slice(0, -1);
  await persist.ensureDir(dir);
  const enc = new TextEncoder().encode(JSON.stringify(order));
  await persist.writeFile(fp, enc, "application/json");
}

/**
 * Returns stored order names for a collection path.
 */
export async function getOrder(persist: PersistAdapter, urlPath: string): Promise<string[]> {
  const o = await readOrderFile(persist, urlPath);
  return o.names;
}

/**
 * Stores explicit order names for a collection path.
 */
export async function setOrder(persist: PersistAdapter, urlPath: string, names: string[]): Promise<void> {
  const filtered = names.filter((s) => typeof s === "string" && s.length > 0);
  await writeOrderFile(persist, urlPath, { names: filtered });
}

/**
 * Applies stored order to the given names array; unknown names are appended
 * in their original order.
 */
export async function applyOrder(persist: PersistAdapter, urlPath: string, names: string[]): Promise<string[]> {
  let order = await getOrder(persist, urlPath);
  if (order.length === 0) {
    // Fallback to DavState props 'Z:order' (comma-separated)
    try {
      const store = createDavStateStore(persist);
      const props = await store.getProps(urlPath);
      const csv = props["Z:order"] ?? "";
      if (typeof csv === "string" && csv.length > 0) {
        order = csv.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      }
    } catch { /* ignore */ }
  }
  if (order.length === 0) { return names; }
  const set = new Set(names);
  const first = order.filter((n) => set.has(n));
  const rest = names.filter((n) => !first.includes(n));
  return [...first, ...rest];
}
