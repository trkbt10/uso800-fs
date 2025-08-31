/**
 * @file DAV sidecar state stored on PersistAdapter (locks, properties).
 */
import type { PersistAdapter } from "./persist/types";

type LockRecord = { token: string; updatedAt: string };
type PropsRecord = Record<string, string>;

function encodePathKey(urlPath: string): string {
  const p = urlPath.startsWith("/") ? urlPath : "/" + urlPath;
  // Use base64url for safety
  const b = Buffer.from(p).toString("base64url");
  return b;
}

function lockPartsFor(urlPath: string): string[] { return ["_dav", "locks", encodePathKey(urlPath) + ".json"]; }
function propsPartsFor(urlPath: string): string[] { return ["_dav", "props", encodePathKey(urlPath) + ".json"]; }

/**
 * Read and validate a LockRecord JSON file.
 */
async function readLockRecord(persist: PersistAdapter, parts: string[]): Promise<LockRecord | null> {
  const exists = await persist.exists(parts);
  if (!exists) { return null; }
  try {
    const data = await persist.readFile(parts);
    const txt = new TextDecoder().decode(data);
    const val = JSON.parse(txt);
    if (typeof val === "object" && val !== null) {
      const rec = val as Record<string, unknown>;
      if (typeof rec.token === "string" && typeof rec.updatedAt === "string") {
        return { token: rec.token, updatedAt: rec.updatedAt };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Read and validate a PropsRecord JSON file.
 */
async function readPropsRecord(persist: PersistAdapter, parts: string[]): Promise<PropsRecord | null> {
  const exists = await persist.exists(parts);
  if (!exists) { return null; }
  try {
    const data = await persist.readFile(parts);
    const txt = new TextDecoder().decode(data);
    const val = JSON.parse(txt);
    if (typeof val === "object" && val !== null) {
      const rec = val as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        if (typeof rec[k] !== "string") { return null; }
      }
      return rec as PropsRecord;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeJson(persist: PersistAdapter, parts: string[], value: unknown): Promise<void> {
  const enc = new TextEncoder().encode(JSON.stringify(value));
  if (parts.length > 1) {
    await persist.ensureDir(parts.slice(0, -1));
  }
  await persist.writeFile(parts, enc, "application/json");
}

export type DavStateStore = {
  getLock(path: string): Promise<LockRecord | null>;
  setLock(path: string, token: string): Promise<void>;
  releaseLock(path: string, token?: string): Promise<boolean>;
  getProps(path: string): Promise<PropsRecord>;
  mergeProps(path: string, patch: PropsRecord): Promise<void>;
};

/**
 * Create a DAV sidecar state store using the provided PersistAdapter.
 */
export function createDavStateStore(persist: PersistAdapter): DavStateStore {
  return {
    async getLock(path: string): Promise<LockRecord | null> {
      const file = lockPartsFor(path);
      return await readLockRecord(persist, file);
    },
    async setLock(path: string, token: string): Promise<void> {
      const rec: LockRecord = { token, updatedAt: new Date().toISOString() };
      const file = lockPartsFor(path);
      await writeJson(persist, file, rec);
    },
    async releaseLock(path: string, token?: string): Promise<boolean> {
      const file = lockPartsFor(path);
      const cur = await readLockRecord(persist, file);
      if (!cur) { return true; }
      if (token && token !== cur.token) { return false; }
      await persist.remove(file);
      return true;
    },
    async getProps(path: string): Promise<PropsRecord> {
      const file = propsPartsFor(path);
      const rec = await readPropsRecord(persist, file);
      if (!rec) { return {}; }
      return rec;
    },
    async mergeProps(path: string, patch: PropsRecord): Promise<void> {
      const file = propsPartsFor(path);
      const cur = await readPropsRecord(persist, file);
      const next = { ...(cur ?? {}), ...patch };
      await writeJson(persist, file, next);
    },
  };
}
