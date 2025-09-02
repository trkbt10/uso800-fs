/**
 * @file macOS Finder/WebDAVFS client dialect policy.
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
    shouldRelaxDepthForDirOps(ctx: DialectContext): boolean {
      return uaIncludes(ctx, /webdavfs|cfnetwork|darwin/i);
    },
  };
}

