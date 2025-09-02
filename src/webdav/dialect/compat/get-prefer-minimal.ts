/**
 * @file Hooks to absorb HTTP Prefer: return=minimal on GET/HEAD.
 *
 * @reference https://www.rfc-editor.org/rfc/rfc7240.txt
 * quote: "The 'return=minimal' preference ... indicates that the client wishes the
 *         server to return only a minimal response to a successful request. Typically, such
 *         responses would utilize the 204 (No Content) status ..."
 */
import type { WebDavHooks } from "../../hooks";
import type { DavResponse } from "../../handlers/types";

function hasPreferReturnMinimal(getHeader: ((n: string) => string) | undefined): boolean {
  if (!getHeader) { return false; }
  const v = getHeader("Prefer") ?? "";
  return /\breturn\s*=\s*minimal\b/i.test(v);
}

/** Create hooks that absorb Prefer:return-minimal for GET/HEAD. */
export function createGetPreferMinimalHooks(): WebDavHooks {
  return {
    async afterGet(ctx, res: DavResponse) {
      const minimal = hasPreferReturnMinimal(ctx.getHeader);
      if (!minimal) { return undefined; }
      if (res.status !== 200) { return undefined; }
      const headers = Object.assign({}, res.headers ?? {});
      headers["Preference-Applied"] = "return=minimal";
      delete headers["Content-Length"];
      return { status: 204, headers };
    },
  };
}

