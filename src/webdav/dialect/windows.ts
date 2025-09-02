/**
 * @file Windows Explorer (WebClient/Mini-Redirector) dialect policy.
 *
 * Rationale (with sources):
 * - Windows’ built‑in WebDAV client (WebClient, Mini‑Redirector) uses
 *   User‑Agent values starting with "Microsoft-WebDAV-MiniRedir/<ver>"; and
 *   Word/Office components sometimes send "DavClnt".
 *   Evidence:
 *   - Greenbytes’ WebDAV Redirector notes the UA prefix explicitly.
 *     https://www.greenbytes.de/tech/webdav/webdav-redirector-list.html
 *   - Microsoft Learn bulletin describing the Mini‑Redirector/WebClient.
 *     https://learn.microsoft.com/en-us/security-updates/securitybulletins/2008/ms08-007
 *   - Didier Stevens captured both DavClnt and Microsoft-WebDAV-MiniRedir in traces.
 *     https://blog.didierstevens.com/2017/11/13/webdav-traffic-to-malicious-sites/
 *
 * - COPY/MOVE on collections: RFC 4918 requires acting as if Depth: infinity
 *   (MOVE) and defaulting to infinity if Depth is absent (COPY). Some
 *   clients, including MiniRedir, omit Depth on directory renames/moves.
 *   We therefore relax Depth enforcement for recognized Windows UAs.
 *   - RFC 4918 §9.9 (MOVE on collections must act as Depth: infinity)
 *   - RFC 4918 §9.8 (COPY without Depth on a collection acts as infinity)
 *     https://www.rfc-editor.org/rfc/rfc4918
 */
import type { DialectPolicy, DialectContext } from "./types";

function uaIncludes(ctx: DialectContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Windows WebDAV Mini-Redirector dialect.
 */
export function windowsWebClientDialect(): DialectPolicy {
  return {
    async ensureDepthOkForDirOps(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean> {
      // @reference (UA token): https://www.greenbytes.de/tech/webdav/webdav-redirector-list.html
      //   quote: "The WebDAV Mini-Redirector sends a User-Agent request header starting with
      //           'Microsoft-WebDAV-MiniRedir'."
      // @reference (normative COPY): https://www.rfc-editor.org/rfc/rfc4918.txt
      //   quote: "The COPY method on a collection without a Depth header MUST act as if a
      //           Depth header with value 'infinity' was included."
      // @reference (normative MOVE): https://www.rfc-editor.org/rfc/rfc4918.txt
      //   quote: "The MOVE method on a collection MUST act as if a 'Depth: infinity' header
      //           was used on it."
      if (uaIncludes(ctx, /(microsoft-webdav-miniredir|davclnt)/i)) { return true; }
      return await defaultCheck();
    },
    async ensureLockOkForProppatch(_ctx, defaultCheck) {
      return await defaultCheck();
    },
  };
}
