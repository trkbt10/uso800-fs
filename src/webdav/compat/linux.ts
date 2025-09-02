/**
 * @file Linux GVFS/gio/cadaver/davfs2 client compatibility policy.
 */
import type { CompatPolicy, CompatContext } from "./types";

function uaIncludes(ctx: CompatContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Linux GVFS/gio/cadaver compatibility.
 */
export function linuxGvfsPolicy(): CompatPolicy {
  return {
    shouldRelaxDepthForDirOps(ctx: CompatContext): boolean {
      if (uaIncludes(ctx, /gvfs|gio\//i)) { return true; }
      if (uaIncludes(ctx, /cadaver/i)) { return true; }
      if (uaIncludes(ctx, /davfs2/i)) { return true; }
      return false;
    },
  };
}

