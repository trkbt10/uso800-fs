/**
 * @file Linux GVFS/gio/cadaver/davfs2 client dialect policy.
 *
 * Rationale (with sources):
 * - GNOME/Ubuntu and Debian file managers mount WebDAV via GVfs/gio and
 *   advertise UAs like "gvfs/<ver>" or "gio/<ver>". Older stacks/tools
 *   include gnome-vfs, cadaver, and davfs2.
 *   Evidence:
 *   - GVfs WebDAV backend source shows the "gvfs" stack and HTTP handling.
 *     https://gitlab.gnome.org/GNOME/gvfs/-/blob/master/daemon/gvfsbackenddav.c
 *   - davfs2 manual shows its User-Agent ("davfs2/<ver> (neon/<ver>)").
 *     https://manpages.debian.org/bullseye/davfs2/davfs2.conf.5.en.html
 *   - cadaver manual and traces show "cadaver/<ver>" UA.
 *     https://manpages.debian.org/bullseye/cadaver/cadaver.1.en.html
 *   - SabreDAV’s client notes list GVFS/gio and others (secondary corroboration).
 *     https://sabre.io/dav/clients/
 *
 * - Some of these clients omit Depth for MOVE/COPY on collections, relying
 *   on RFC 4918 semantics that servers treat these as Depth: infinity.
 *   We relax Depth enforcement to interoperate smoothly.
 *   - RFC 4918 §9.9 (MOVE) and §9.8 (COPY)
 *     https://www.rfc-editor.org/rfc/rfc4918
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
    async ensureDepthOkForDirOps(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean> {
      // @reference (GVfs WebDAV backend): https://gitlab.gnome.org/GNOME/gvfs/-/blob/master/daemon/gvfsbackenddav.c
      //   quote: "gvfsbackenddav.c" (WebDAV backend implementation in GVfs)
      // @reference (normative COPY): https://www.rfc-editor.org/rfc/rfc4918.txt
      //   quote: "The COPY method on a collection without a Depth header MUST act as if a
      //           Depth header with value 'infinity' was included."
      // @reference (normative MOVE): https://www.rfc-editor.org/rfc/rfc4918.txt
      //   quote: "The MOVE method on a collection MUST act as if a 'Depth: infinity' header
      //           was used on it."
      // Detect GVfs/gio/gnome-vfs and common CLI WebDAV clients; relax Depth enforcement for dir ops.
      // GVfs/gio (Ubuntu/Debian GNOME), older gnome-vfs
      if (uaIncludes(ctx, /(gvfs|gio\/|gnome-vfs)/i)) { return true; }
      if (uaIncludes(ctx, /cadaver/i)) { return true; }
      if (uaIncludes(ctx, /davfs2/i)) { return true; }
      return await defaultCheck();
    },
    async ensureLockOkForProppatch(_ctx, defaultCheck) {
      return await defaultCheck();
    },
  };
}
