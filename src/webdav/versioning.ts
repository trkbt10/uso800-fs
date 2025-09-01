/**
 * @file Minimal file versioning utilities (Delta-V inspired).
 */
import type { PersistAdapter } from "./persist/types";

type VersionMeta = {
  id: string;
  size: number;
  mime?: string;
  createdAt: string;
};

type MetaFile = { versions: VersionMeta[] };

function encodeKey(urlPath: string): string {
  const p = urlPath.startsWith("/") ? urlPath : "/" + urlPath;
  return Buffer.from(p).toString("base64url");
}

function metaPath(urlPath: string): string[] { return ["_dav", "versions", encodeKey(urlPath), "meta.json"]; }
function dataPath(urlPath: string, id: string): string[] { return ["_dav", "versions", encodeKey(urlPath), `${id}.bin`]; }

/**
 * Reads versions metadata for a path. Returns an empty list when missing.
 */
async function readMeta(persist: PersistAdapter, urlPath: string): Promise<MetaFile> {
  const mp = metaPath(urlPath);
  const exists = await persist.exists(mp);
  if (!exists) { return { versions: [] }; }
  try {
    const buf = await persist.readFile(mp);
    const txt = new TextDecoder().decode(buf);
    const val = JSON.parse(txt);
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      const arr = obj["versions"];
      if (Array.isArray(arr)) {
        const versions: VersionMeta[] = arr
          .map((x): VersionMeta | null => {
            if (typeof x !== "object" || x === null) { return null; }
            const r = x as Record<string, unknown>;
            const id = String(r.id ?? "");
            const sizeNum = Number(r.size);
            const size = Number.isFinite(sizeNum) && sizeNum >= 0 ? Math.floor(sizeNum) : 0;
            const mime = typeof r.mime === "string" ? (r.mime as string) : undefined;
            const createdAt = typeof r.createdAt === "string" ? (r.createdAt as string) : new Date().toISOString();
            return { id, size, mime, createdAt };
          })
          .filter((v): v is VersionMeta => v !== null);
        return { versions };
      }
    }
  } catch { /* ignore */ }
  return { versions: [] };
}

/**
 * Writes versions metadata to sidecar store.
 */
async function writeMeta(persist: PersistAdapter, urlPath: string, meta: MetaFile): Promise<void> {
  const mp = metaPath(urlPath);
  const dir = mp.slice(0, -1);
  await persist.ensureDir(dir);
  const enc = new TextEncoder().encode(JSON.stringify(meta));
  await persist.writeFile(mp, enc, "application/json");
}

/**
 * Appends a new version snapshot (binary copy) for the given resource.
 */
export async function recordVersion(persist: PersistAdapter, urlPath: string, data: Uint8Array, mime?: string): Promise<VersionMeta> {
  const meta = await readMeta(persist, urlPath);
  const nextId = String(meta.versions.length + 1);
  const dp = dataPath(urlPath, nextId);
  const dir = dp.slice(0, -1);
  await persist.ensureDir(dir);
  await persist.writeFile(dp, data, mime ?? "application/octet-stream");
  const rec: VersionMeta = { id: nextId, size: data.length, mime, createdAt: new Date().toISOString() };
  meta.versions.push(rec);
  await writeMeta(persist, urlPath, meta);
  return rec;
}

/**
 * Lists versions metadata for a resource.
 */
export async function listVersions(persist: PersistAdapter, urlPath: string): Promise<VersionMeta[]> {
  const meta = await readMeta(persist, urlPath);
  return meta.versions;
}

/**
 * Reads a specific version's content.
 */
export async function readVersion(persist: PersistAdapter, urlPath: string, id: string): Promise<{ data: Uint8Array; mime?: string } | null> {
  const meta = await readMeta(persist, urlPath);
  const rec = meta.versions.find((v) => v.id === id);
  if (!rec) { return null; }
  const dp = dataPath(urlPath, id);
  try {
    const buf = await persist.readFile(dp);
    return { data: buf, mime: rec.mime };
  } catch {
    return null;
  }
}
