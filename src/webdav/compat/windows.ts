/**
 * @file Windows WebDAV Mini-Redirector client compatibility policy.
 */
import type { CompatPolicy, CompatContext } from "./types";

function uaIncludes(ctx: CompatContext, re: RegExp): boolean {
  return re.test(ctx.userAgent);
}

/**
 * Windows WebDAV Mini-Redirector compatibility.
 */
export function windowsWebClientPolicy(): CompatPolicy {
  return {
    shouldRelaxDepthForDirOps(ctx: CompatContext): boolean {
      // MiniRedir often identifies as Microsoft-WebDAV-MiniRedir
      return uaIncludes(ctx, /microsoft-webdav-miniredir/i);
    },
  };
}

