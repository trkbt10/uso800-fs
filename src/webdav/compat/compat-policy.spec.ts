/**
 * @file Unit tests for client-compat policies.
 */
import { strictPolicy, composePolicies } from "./types";
import { finderPolicy } from "./finder";
import { windowsWebClientPolicy } from "./windows";
import { linuxGvfsPolicy } from "./linux";

function ctx(ua: string) {
  return { method: "MOVE", path: "/dir", userAgent: ua, getHeader: () => "" } as const;
}

describe("compat policies", () => {
  it("strictPolicy never relaxes", () => {
    const p = strictPolicy();
    expect(p.shouldRelaxDepthForDirOps(ctx("WebDAVFS/3.0"))).toBe(false);
  });

  it("finderPolicy detects Finder UAs", () => {
    const p = finderPolicy();
    expect(p.shouldRelaxDepthForDirOps(ctx("WebDAVFS/3.0 (Darwin) CFNetwork"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
  });

  it("windowsWebClientPolicy detects MiniRedir", () => {
    const p = windowsWebClientPolicy();
    expect(p.shouldRelaxDepthForDirOps(ctx("Microsoft-WebDAV-MiniRedir/10.0.22621"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
  });

  it("linuxGvfsPolicy detects gvfs/gio/cadaver", () => {
    const p = linuxGvfsPolicy();
    expect(p.shouldRelaxDepthForDirOps(ctx("gvfs/1.50.0"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("gio/2.0"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("cadaver/0.23.3"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("davfs2/1.6.1"))).toBe(true);
    expect(p.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
  });

  it("composePolicies relaxes when any policy matches", () => {
    const chain = composePolicies([strictPolicy(), finderPolicy(), windowsWebClientPolicy()]);
    expect(chain.shouldRelaxDepthForDirOps(ctx("curl/8.0"))).toBe(false);
    expect(chain.shouldRelaxDepthForDirOps(ctx("Microsoft-WebDAV-MiniRedir"))).toBe(true);
  });
});
