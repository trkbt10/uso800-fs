/**
 * @file Finder compatibility: allow directory MOVE/COPY without Depth header when relax mode enabled.
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

describe("WebDAV Finder compatibility mode", () => {
  it("MOVE dir without Depth succeeds when relaxDepthForDirOps=true", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, relaxDepthForDirOps: true });
    await app.request(new Request("http://localhost/dir", { method: "MKCOL" }));
    const res = await app.request(new Request("http://localhost/dir", { method: "MOVE", headers: { Destination: "http://localhost/dir2" } }));
    expect([201, 204]).toContain(res.status);
  });

  it("COPY dir without Depth succeeds when relaxDepthForDirOps=true", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, relaxDepthForDirOps: true });
    await app.request(new Request("http://localhost/dir", { method: "MKCOL" }));
    const res = await app.request(new Request("http://localhost/dir", { method: "COPY", headers: { Destination: "http://localhost/dir-copy" } }));
    expect([201, 204]).toContain(res.status);
  });

  it("AUTO mode: succeeds for Finder UA, strict for others", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, relaxDepthForDirOps: "auto" });
    await app.request(new Request("http://localhost/dir", { method: "MKCOL" }));

    // Finder-like User-Agent
    const moveFinder = await app.request(new Request("http://localhost/dir", {
      method: "MOVE",
      headers: { Destination: "http://localhost/dir2", "User-Agent": "WebDAVFS/3.0 (Darwin)" },
    }));
    expect([201, 204]).toContain(moveFinder.status);

    // Strict for non-Finder UA
    await app.request(new Request("http://localhost/dir3", { method: "MKCOL" }));
    const moveCurl = await app.request(new Request("http://localhost/dir3", {
      method: "MOVE",
      headers: { Destination: "http://localhost/dir4", "User-Agent": "curl/8.0" },
    }));
    expect(moveCurl.status).toBe(400);
  });
});
