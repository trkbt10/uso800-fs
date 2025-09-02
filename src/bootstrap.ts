/**
 * @file Startup bootstrap helpers to optionally populate initial filesystem contents.
 * WebDAV and LLM remain separated: this module accepts only the dependencies needed
 * to perform bootstrap and becomes a no-op when generation is not provided.
 */
import type { PersistAdapter } from "./webdav/persist/types";

export type FabricateListingFn = (path: string[], opts?: { depth?: string | null }) => Promise<void>;

/**
 * Ensures root exists and, if empty and a fabricateListing function is provided,
 * generates an initial listing once. When fabricateListing is absent, this is a no-op.
 */
export async function bootstrapInitialFs(
  persist: PersistAdapter,
  options?: { fabricateListing?: FabricateListingFn; silent?: boolean },
): Promise<void> {
  const fabricateListing = options?.fabricateListing;
  if (!fabricateListing) { return; }
  try {
    await persist.ensureDir([]);
    const names = await persist.readdir([]).catch(() => [] as string[]);
    if (names.length !== 0) { return; }
    if (!options?.silent) { console.log("[uso800fs] Bootstrapping initial filesystem (root)…"); }
    await fabricateListing([], { depth: "1" });
    if (!options?.silent) {
      const after = await persist.readdir([]).catch(() => [] as string[]);
      const summary = after.length > 0 ? after.join(", ") : "<none>";
      console.log(`[uso800fs] Bootstrap complete. Root items: ${summary}`);
    }
  } catch (e) {
    // Be tolerant on bootstrap; generation is best-effort.
    if (!options?.silent) {
      console.warn("[uso800fs] Bootstrap skipped due to error:", (e as Error)?.message ?? e);
    }
  }
}

