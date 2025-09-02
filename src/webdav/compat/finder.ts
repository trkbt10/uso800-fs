/**
 * @file macOS Finder/WebDAVFS client compatibility policy.
 */
import type { CompatPolicy, CompatContext } from "./types";

function uaIncludes(ctx: CompatContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Finder (macOS) WebDAVFS compatibility: relax Depth for dir ops.
 */
export function finderPolicy(): CompatPolicy {
  return {
    shouldRelaxDepthForDirOps(ctx: CompatContext): boolean {
      return uaIncludes(ctx, /webdavfs|cfnetwork|darwin/i);
    },
  };
}

