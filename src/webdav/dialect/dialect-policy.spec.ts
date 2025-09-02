/**
 * @file Unit tests for client-compat policies.
 */
import { strictDialect, composeDialects } from "./types";
import { finderDialect } from "./finder";
import { windowsWebClientDialect } from "./windows";
import { linuxGvfsDialect } from "./linux";

function ctx(ua: string) {
  return { method: "MOVE", path: "/dir", userAgent: ua, getHeader: () => "" } as const;
}

describe("compat policies", () => {
  it("strictDialect calls defaultCheck (never relaxes by itself)", async () => {
    const p = strictDialect();
    const res1 = await p.ensureDepthOkForDirOps(ctx("WebDAVFS/3.0"), async () => Promise.resolve(false));
    expect(res1).toBe(false);
    const res2 = await p.ensureDepthOkForDirOps(ctx("curl/8.0"), async () => Promise.resolve(true));
    expect(res2).toBe(true);
  });

  it("finderDialect detects Finder UAs", async () => {
    const p = finderDialect();
    const ok = await p.ensureDepthOkForDirOps(ctx("WebDAVFS/3.0 (Darwin) CFNetwork"), async () => Promise.resolve(false));
    expect(ok).toBe(true);
    const ng = await p.ensureDepthOkForDirOps(ctx("curl/8.0"), async () => Promise.resolve(false));
    expect(ng).toBe(false);
  });

  it("windowsWebClientDialect detects MiniRedir", async () => {
    const p = windowsWebClientDialect();
    const a = await p.ensureDepthOkForDirOps(ctx("Microsoft-WebDAV-MiniRedir/10.0.22621"), async () => false);
    const b = await p.ensureDepthOkForDirOps(ctx("DavClnt"), async () => false);
    const c = await p.ensureDepthOkForDirOps(ctx("curl/8.0"), async () => false);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(false);
  });

  it("linuxGvfsDialect detects gvfs/gio/cadaver", async () => {
    const p = linuxGvfsDialect();
    expect(await p.ensureDepthOkForDirOps(ctx("gvfs/1.50.0"), async () => false)).toBe(true);
    expect(await p.ensureDepthOkForDirOps(ctx("gio/2.0"), async () => false)).toBe(true);
    expect(await p.ensureDepthOkForDirOps(ctx("gnome-vfs/2.24"), async () => false)).toBe(true);
    expect(await p.ensureDepthOkForDirOps(ctx("cadaver/0.23.3"), async () => false)).toBe(true);
    expect(await p.ensureDepthOkForDirOps(ctx("davfs2/1.6.1"), async () => false)).toBe(true);
    expect(await p.ensureDepthOkForDirOps(ctx("curl/8.0"), async () => false)).toBe(false);
  });

  it("composeDialects relaxes when any policy matches", async () => {
    const chain = composeDialects([strictDialect(), finderDialect(), windowsWebClientDialect()]);
    const ng = await chain.ensureDepthOkForDirOps(ctx("curl/8.0"), async () => Promise.resolve(false));
    const ok = await chain.ensureDepthOkForDirOps(ctx("Microsoft-WebDAV-MiniRedir"), async () => Promise.resolve(false));
    expect(ng).toBe(false);
    expect(ok).toBe(true);
  });
});
