/**
 * @file Linux GVFS/gio/cadaver/davfs2 client dialect policy.
 */
import type { DialectPolicy, DialectContext } from "./types";

function uaIncludes(ctx: DialectContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Linux GVFS/gio/cadaver/davfs2 dialect.
 */
export function linuxGvfsDialect(): DialectPolicy {
  return {
    shouldRelaxDepthForDirOps(ctx: DialectContext): boolean {
      if (uaIncludes(ctx, /gvfs|gio\//i)) { return true; }
      if (uaIncludes(ctx, /cadaver/i)) { return true; }
      if (uaIncludes(ctx, /davfs2/i)) { return true; }
      return false;
    },
  };
}

