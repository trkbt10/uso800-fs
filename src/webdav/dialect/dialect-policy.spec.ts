/**
 * @file Unit tests for client-compat policies.
 */
import { strictDialect, composeDialects } from "../dialect/types";
import { finderDialect } from "./finder";
import { windowsWebClientDialect } from "./windows";
import { linuxGvfsDialect } from "./linux";

function ctx(ua: string) {
  return { method: "MOVE", path: "/dir", userAgent: ua, getHeader: () => "" } as const;
}

describe("compat policies", () => {
  it("strictDialect never relaxes", () => {
    const p = strictDialect();
    expect(p.shouldRelaxDepthForDirOps(ctx("WebDAVFS/3.0"))).toBe(false);
  });

  it("finderDialect detects Finder UAs", () => {
    const p = finderDialect();
    expect(p.shouldRelaxDepthForDirOps(ctx("WebDAVFS/3.0 (Darwin) CFNetwork"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
  });

  it("windowsWebClientDialect detects MiniRedir", () => {
    const p = windowsWebClientDialect();
    expect(p.shouldRelaxDepthForDirOps(ctx("Microsoft-WebDAV-MiniRedir/10.0.22621"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
  });

  it("linuxGvfsDialect detects gvfs/gio/cadaver", () => {
    const p = linuxGvfsDialect();
    expect(p.shouldRelaxDepthForDirOps(ctx("gvfs/1.50.0"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("gio/2.0"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("cadaver/0.23.3"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("davfs2/1.6.1"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
  });

  it("composeDialects relaxes when any policy matches", () => {
    const chain = composeDialects([strictDialect(), finderDialect(), windowsWebClientDialect()]);
    expect(chain.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
    expect(chain.shouldRelaxDepthForDirOps(ctx("Microsoft-WebDAV-MiniRedir"))).toBe(true);
  });
});
