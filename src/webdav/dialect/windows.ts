/**
 * @file Windows WebDAV Mini-Redirector client dialect policy.
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
    shouldRelaxDepthForDirOps(ctx: DialectContext): boolean {
      // MiniRedir often identifies as Microsoft-WebDAV-MiniRedir
      return uaIncludes(ctx, /microsoft-webdav-miniredir/i);
    },
  };
}

