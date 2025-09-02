/**
 * @file Hooks to supply minimal DAV:lockdiscovery / DAV:supportedlock values on PROPFIND.
 *
 * Rationale:
 * - DAV:lockdiscovery: empty element when no active locks (server may still advertise property).
 *   @reference https://www.rfc-editor.org/rfc/rfc4918.txt
 *   quote: "lockdiscovery ... <!ELEMENT lockdiscovery (activelock)*>" (empty when none)
 *
 * - DAV:supportedlock: list of supported lock entries; this server supports exclusive write locks.
 *   @reference https://www.rfc-editor.org/rfc/rfc4918.txt
 *   quote: "supportedlock ... <!ELEMENT supportedlock (lockentry)*>" and
 *          example shows <lockscope><exclusive/></lockscope><locktype><write/></locktype>
 */
import type { WebDavHooks } from "../../hooks";
import type { DavResponse } from "../../handlers/types";

function transformOneResponse(xml: string): string {
  return xml.replace(/<D:propstat>[\s\S]*?<\/D:propstat>/gi, (seg) => {
    const is404 = /HTTP\/1\.1 404 Not Found/i.test(seg);
    if (!is404) { return seg; }
    const needsSupported = /<\s*D:supportedlock\s*\/\s*>/i.test(seg);
    const needsDiscovery = /<\s*D:lockdiscovery\s*\/\s*>/i.test(seg);
    if (!needsSupported && !needsDiscovery) { return seg; }
    const supported = needsSupported
      ? ("<D:supportedlock>" +
         "<D:lockentry>" +
         "<D:lockscope><D:exclusive/></D:lockscope>" +
         "<D:locktype><D:write/></D:locktype>" +
         "</D:lockentry>" +
         "</D:supportedlock>")
      : "";
    const discovery = needsDiscovery ? "<D:lockdiscovery/>" : "";
    return "<D:propstat>\n  <D:prop>" + supported + discovery + "  </D:prop>\n  <D:status>HTTP/1.1 200 OK</D:status>\n</D:propstat>";
  });
}

/**
 * Hook factory: afterPropfind minimalizes lock props when requested but missing.
 * - If the response contains 404-propstat for DAV:lockdiscovery / DAV:supportedlock,
 *   rewrites that block to 200 and injects minimal, standards-compliant values.
 */
export function createPropfindLockPropsCompatHooks(): WebDavHooks {
  return {
    async afterPropfind(_ctx, res: DavResponse) {
      if (typeof res.body !== "string") { return undefined; }
      if (!/\b<\s*D:multistatus\b/i.test(res.body)) { return undefined; }
      const responseRe = /<D:response>[\s\S]*?<\/D:response>/gi;
      const transformed = res.body.replace(responseRe, (m) => transformOneResponse(m));
      if (transformed === res.body) { return undefined; }
      return { status: res.status, headers: res.headers, body: transformed };
    },
  };
}
