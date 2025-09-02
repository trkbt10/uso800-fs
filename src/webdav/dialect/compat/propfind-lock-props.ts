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
  const replaced = xml.replace(/<\s*D:propstat\s*>[\s\S]*?<\s*\/\s*D:propstat\s*>/gi, (seg) => {
    const is404 = /HTTP\/1\.1 404 Not Found/i.test(seg);
    if (!is404) { return seg; }
    const needsSupported = /<\s*D:supportedlock\s*\/\s*>/i.test(seg);
    const needsDiscovery = /<\s*D:lockdiscovery\s*\/\s*>/i.test(seg);
    if (!needsSupported && !needsDiscovery) { return seg; }
    // Extract inner props
    const propContentMatch = seg.match(/<\s*D:prop\b[^>]*>([\s\S]*?)<\s*\/\s*D:prop\s*>/i);
    const innerContent = propContentMatch ? propContentMatch[1] : "";
    // Remove lock props from the 404 block
    const rest = innerContent
      .replace(/<\s*D:supportedlock\s*\/\s*>/gi, "")
      .replace(/<\s*D:lockdiscovery\s*\/\s*>/gi, "")
      .trim();
    const restClean = rest.replace(/<\s*D:prop\s*\/\s*>/gi, "").trim();
    function supportedBlock(): string {
      if (!needsSupported) { return ""; }
      return (
        "<D:supportedlock>" +
        "<D:lockentry>" +
        "<D:lockscope><D:exclusive/></D:lockscope>" +
        "<D:locktype><D:write/></D:locktype>" +
        "</D:lockentry>" +
        "</D:supportedlock>"
      );
    }
    function discoveryBlock(): string {
      if (!needsDiscovery) { return ""; }
      return "<D:lockdiscovery/>";
    }
    const ok200 = (
      "<D:propstat>\n  <D:prop>" +
      supportedBlock() +
      discoveryBlock() +
      "  </D:prop>\n  <D:status>HTTP/1.1 200 OK</D:status>\n</D:propstat>"
    );
    const hasRest = /<\s*D:\w+/i.test(restClean);
    function notFoundBlock(): string {
      if (!hasRest) { return ""; }
      return "<D:propstat>\n  <D:prop>" + restClean + "  </D:prop>\n  <D:status>HTTP/1.1 404 Not Found</D:status>\n</D:propstat>";
    }
    return ok200 + notFoundBlock();
  });
  // If no 200 minimal block exists yet, append one before </D:response>
  const hasSupported = /<\s*D:supportedlock\b[\s\S]*<\/\s*D:supportedlock\s*>/i.test(replaced);
  const hasDiscovery = /<\s*D:lockdiscovery\s*\/>/i.test(replaced);
  if (!hasSupported || !hasDiscovery) {
    const minimal = (
      "<D:propstat>\n  <D:prop>" +
      "<D:supportedlock><D:lockentry><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockentry></D:supportedlock>" +
      "<D:lockdiscovery/>" +
      "  </D:prop>\n  <D:status>HTTP/1.1 200 OK</D:status>\n</D:propstat>"
    );
    const injected = replaced.replace(/<\s*\/\s*D:response\s*>/i, minimal + "</D:response>");
    return injected;
  }
  return replaced;
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
      // Accept any leading characters; avoid word-boundary pitfalls
      if (!/<\s*D:multistatus\b/i.test(res.body)) { return undefined; }
      const responseRe = /<\s*D:response\s*>[\s\S]*?<\s*\/\s*D:response\s*>/gi;
      const transformed = res.body.replace(responseRe, (m) => transformOneResponse(m));
      if (transformed === res.body) { return undefined; }
      return { status: res.status, headers: res.headers, body: transformed };
    },
  };
}
