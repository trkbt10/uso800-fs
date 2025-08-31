/**
 * @file LOCK/UNLOCK handlers using DavStateStore sidecar
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { createDavStateStore } from "../dav-state";

/**
 * Handle LOCK. Returns a lock token; if already locked, returns existing token.
 */
export async function handleLockRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist } = options;
  const store = createDavStateStore(persist);
  const existing = await store.getLock(urlPath);
  if (existing) {
    return { response: { status: 200, headers: { "Lock-Token": existing.token }, body: `<?xml version="1.0"?><prop xmlns="DAV:"><lockdiscovery/></prop>` } };
  }
  const token = `opaquelocktoken:${globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
  await store.setLock(urlPath, token);
  return { response: { status: 200, headers: { "Lock-Token": token }, body: `<?xml version="1.0"?><prop xmlns="DAV:"><lockdiscovery/></prop>` } };
}

/**
 * Handle UNLOCK. Releases a lock if token matches.
 */
export async function handleUnlockRequest(urlPath: string, token: string | null | undefined, options: HandlerOptions): Promise<HandlerResult> {
  const { persist } = options;
  const store = createDavStateStore(persist);
  const ok = await store.releaseLock(urlPath, token ?? undefined);
  if (!ok) { return { response: { status: 409 } }; }
  return { response: { status: 204 } };
}
