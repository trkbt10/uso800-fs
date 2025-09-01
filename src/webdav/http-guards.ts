/**
 * @file Common HTTP/WebDAV guard helpers extracted for reuse and unit testing.
 */
import type { PersistAdapter, Stat } from "./persist/types";
import type { DavStateStore } from "./dav-state";

/**
 * Extracts a lock token from an If header: e.g., If: (<opaquelocktoken:...>)
 */
export function extractLockTokenFromIfHeader(ifHeader: string | undefined | null): string | undefined {
  if (!ifHeader) { return undefined; }
  const m = /<\s*([^>]+)\s*>/.exec(ifHeader);
  const token = m?.[1] ?? "";
  if (token) { return token; }
  return undefined;
}

/**
 * Computes a weak ETag from a file stat.
 */
export function computeWeakEtagFromStat(st: Stat): string {
  return `W/"${String(st.size ?? 0)}-${st.mtime ?? ""}"`;
}

/**
 * Returns true if a lock is not present, or if the provided headers include
 * a matching lock token via either Lock-Token or If header.
 */
export async function requireLockOk(davState: DavStateStore, path: string, headers: Headers, fallbackHeaderName?: string): Promise<boolean> {
  const curLock = await davState.getLock(path);
  if (!curLock) { return true; }
  const tokenHeader = fallbackHeaderName ? headers.get(fallbackHeaderName) : null;
  const tokenIf = extractLockTokenFromIfHeader(headers.get("If"));
  const provided = tokenHeader ?? tokenIf ?? undefined;
  return provided === curLock.token;
}

/**
 * When the source is a directory, require Depth: infinity header.
 * Returns true when the operation is allowed under depth rules.
 */
export async function checkDepthInfinityRequiredForDir(persist: PersistAdapter, path: string, getDepthHeader: () => string | undefined | null): Promise<boolean> {
  const parts = path.split("/").filter((p) => p !== "");
  const isDir = await persist.stat(parts).then((s) => s.type === "dir").catch(() => false);
  if (!isDir) { return true; }
  const depthHeader = (getDepthHeader() ?? "").toLowerCase();
  return depthHeader === "infinity";
}

/**
 * Checks ETag precondition when If header contains bracketed ETag tokens.
 * Returns true if there is no ETag condition or if it matches current ETag.
 */
export async function etagMatchesIfHeader(persist: PersistAdapter, path: string, headers: Headers): Promise<boolean> {
  const ifHeader = headers.get("If");
  if (!ifHeader) { return true; }
  const etags: string[] = [];
  for (const m of ifHeader.matchAll(/\[\s*([^\]]+)\s*\]/g)) {
    const val = (m[1] ?? "").trim();
    if (val) { etags.push(val); }
  }
  if (etags.length === 0) { return true; }
  try {
    const parts = path.split("/").filter((p) => p !== "");
    const st = await persist.stat(parts);
    if (st.type !== "file") { return true; }
    const etag = computeWeakEtagFromStat(st);
    return etags.includes(etag);
  } catch {
    return true;
  }
}
