/**
 * @file macOS Finder/WebDAVFS client dialect policy.
 *
 * Rationale (with sources):
 * - Finder (WebDAVFS on Darwin) typically reports a UA containing
 *   "WebDAVFS" and often "Darwin" / "CFNetwork".
 *   Evidence:
 *   - Apple Support Communities thread shows logs with
 *     "WebDAVFS/3.x (Darwin) CFNetwork".
 *     https://discussions.apple.com/thread/250079937
 *   - Web server logs and interop notes widely record this UA; see also
 *     SabreDAV’s client notes (secondary corroboration).
 *     https://sabre.io/dav/clients/
 *
 * - Directory MOVE/COPY Depth behavior: Some Finder versions omit the
 *   Depth header on folder rename/move. Per RFC 4918, servers must act
 *   as if Depth: infinity for MOVE, and treat omitted Depth on COPY as
 *   infinity by default. We relax Depth enforcement for Finder UAs.
 *   - RFC 4918 §9.9 (MOVE)
 *   - RFC 4918 §9.8 (COPY)
 *     https://www.rfc-editor.org/rfc/rfc4918
 */
import type { DialectPolicy, DialectContext } from "./types";

function uaIncludes(ctx: DialectContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Finder (macOS) WebDAVFS dialect: relax Depth for dir ops.
 */
export function finderDialect(): DialectPolicy {
  return {
    async ensureDepthOkForDirOps(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean> {
      // @reference (normative COPY): https://www.rfc-editor.org/rfc/rfc4918.txt
      //   quote: "The COPY method on a collection without a Depth header MUST act as if a
      //           Depth header with value 'infinity' was included."
      // @reference (normative MOVE): https://www.rfc-editor.org/rfc/rfc4918.txt
      //   quote: "The MOVE method on a collection MUST act as if a 'Depth: infinity' header
      //           was used on it."
      // Detect Finder/WebDAVFS UAs and relax Depth enforcement for dir ops.
      // Typical Finder signatures: WebDAVFS/3.x, Darwin, CFNetwork
      if (uaIncludes(ctx, /(webdavfs|cfnetwork|darwin)/i)) { return true; }
      return await defaultCheck();
    },
    async ensureLockOkForProppatch(_ctx, defaultCheck) {
      return await defaultCheck();
    },
  };
}
