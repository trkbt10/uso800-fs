/**
 * @file Microsoft Office WebDAV client dialect policy.
 *
 * @reference https://sabre.io/dav/clients/msoffice/
 * quote: "However, it appears to disregard any existing locks on the resource, and
 *         attempt to perform this request without any supplied lock tokens." (PROPPATCH)
 */
import type { DialectPolicy, DialectContext } from "./types";

function uaIncludes(ctx: DialectContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Microsoft Office dialect: absorbs missing Lock-Token on PROPPATCH.
 */
export function officeDialect(): DialectPolicy {
  return {
    async ensureDepthOkForDirOps(_ctx, defaultCheck) {
      return await defaultCheck();
    },
    async ensureLockOkForProppatch(ctx, defaultCheck) {
      if (uaIncludes(ctx, /microsoft\s*office/i)) { return true; }
      return await defaultCheck();
    },
  };
}
