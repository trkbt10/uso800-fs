/**
 * @file Helper to centralize Depth handling via dialect policy.
 * Hides header extraction and default RFC checks for directory COPY/MOVE-like ops.
 */
import type { Context } from "hono";
import type { DialectPolicy } from "./types";
import type { PersistAdapter } from "../persist/types";
import { checkDepthInfinityRequiredForDir } from "../http-guards";
import type { DavStateStore } from "../dav-state";
import { requireLockOk } from "../http-guards";

/**
 * Ensure Depth is acceptable for directory MOVE/COPY-like ops.
 *
 * Behavior: gives the active `dialect` a chance to absorb the operation.
 * If the dialect does not absorb, delegates to the RFC check via `defaultCheck`.
 * This prevents duplicating header extraction and default semantics at call sites.
 */
export async function ensureDepthOkForDirOpsGuard(
  dialect: DialectPolicy,
  c: Context,
  method: string,
  path: string,
  persist: PersistAdapter,
): Promise<boolean> {
  const uaHeader = c.req.header("User-Agent");
  const ua = typeof uaHeader === "string" ? uaHeader : "";
  return await dialect.ensureDepthOkForDirOps(
    {
      method,
      path,
      userAgent: ua,
      getHeader(name: string): string {
        const v = c.req.header(name);
        return typeof v === "string" ? v : "";
      },
    },
    async () => await checkDepthInfinityRequiredForDir(persist, path, () => c.req.header("Depth")),
  );
}

/** Ensure lock token is acceptable for PROPPATCH, allowing policy to absorb. */
export async function ensureLockOkForProppatchGuard(
  dialect: DialectPolicy,
  davState: DavStateStore,
  c: Context,
  path: string,
): Promise<boolean> {
  return await dialect.ensureLockOkForProppatch(
    {
      method: "PROPPATCH",
      path,
      userAgent: (c.req.header("User-Agent") ?? "") as string,
      getHeader(name: string): string { const v = c.req.header(name); return typeof v === "string" ? v : ""; },
    },
    async () => await requireLockOk(davState, path, c.req.raw.headers, "Lock-Token"),
  );
}
