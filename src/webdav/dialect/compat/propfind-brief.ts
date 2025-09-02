/**
 * @file Hooks to absorb PROPFIND response minimization quirks.
 *
 * - Microsoft Office may send "Brief: t" with PROPFIND (SabreDAV notes).
 *   @reference https://sabre.io/dav/clients/msoffice/
 *   quote: "PROPFIND ... Brief: t\nDepth: 0"
 *
 * - RFC 7240 Prefer:return-minimal allows clients to request minimal bodies.
 *   @reference https://www.rfc-editor.org/rfc/rfc7240.txt
 *   quote: "The 'return=minimal' preference ... indicates that the client wishes the
 *           server to return only a minimal response to a successful request."
 */
import type { WebDavHooks, WebDavPropfindContext } from "../../hooks";
import type { DavResponse } from "../../handlers/types";

function hasBriefHeader(ctx: WebDavPropfindContext): boolean {
  const v = ctx.getHeader?.("Brief") ?? "";
  return /^t$/i.test(v.trim());
}

function hasPreferReturnMinimal(ctx: WebDavPropfindContext): boolean {
  const v = ctx.getHeader?.("Prefer") ?? "";
  return /\breturn\s*=\s*minimal\b/i.test(v);
}

function strip404Propstat(xml: string): string {
  return xml.replace(/<D:propstat>[\s\S]*?<D:status>HTTP\/1\.1 404 Not Found<\/D:status>[\s\S]*?<\/D:propstat>/g, "");
}

/** Create hooks that absorb Brief: t and Prefer: return-minimal on PROPFIND. */
export function createPropfindBriefCompatHooks(): WebDavHooks {
  return {
    async afterPropfind(ctx: WebDavPropfindContext, res: DavResponse) {
      const brief = hasBriefHeader(ctx);
      const minimal = hasPreferReturnMinimal(ctx);
      if (!brief && !minimal) { return undefined; }
      if (typeof res.body !== "string") { return undefined; }
      const body = strip404Propstat(res.body);
      const headers = Object.assign({}, res.headers ?? {});
      if (minimal) {
        headers["Preference-Applied"] = "return=minimal";
      }
      return { status: res.status, headers, body };
    },
  };
}

