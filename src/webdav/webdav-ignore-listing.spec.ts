/**
 * @file Verify that default ignore patterns (e.g., AppleDouble ._* and .DS_Store)
 * are excluded from PROPFIND listings.
 */

// Use global describe/it/expect injected by the test runner
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

describe("WebDAV default ignore patterns in listings", () => {
  it("omits Apple/metadata files from root PROPFIND depth=1", async () => {
    const persist = createMemoryAdapter();
    // Seed files and directories, including ignored names
    await persist.writeFile(["visible.txt"], new TextEncoder().encode("ok"), "text/plain");
    await persist.ensureDir(["visible-dir"]);
    await persist.writeFile(["._ghost"], new TextEncoder().encode("nope"), "application/octet-stream");
    await persist.writeFile([".DS_Store"], new Uint8Array(), "application/octet-stream");

    const app = makeWebdavApp({ persist });

    const req = new Request("http://localhost/", {
      method: "PROPFIND",
      headers: { Depth: "1" },
    });
    const res = await app.request(req);
    expect(res.status).toBe(207);
    const body = await res.text();

    // Expect visible entries present
    expect(body).toContain("<D:href>/visible.txt</D:href>");
    expect(body).toContain("<D:href>/visible-dir/</D:href>");

    // Expect ignored entries absent
    expect(body).not.toContain("<D:href>/._ghost</D:href>");
    expect(body).not.toContain("<D:href>/.DS_Store</D:href>");
  });

  it("omits ignored files within subdirectory listings", async () => {
    const persist = createMemoryAdapter();
    await persist.ensureDir(["folder"]);
    await persist.writeFile(["folder", "visible.md"], new TextEncoder().encode("ok"), "text/markdown");
    await persist.writeFile(["folder", "._hidden"], new Uint8Array(), "application/octet-stream");
    await persist.writeFile(["folder", ".AppleDouble"], new Uint8Array(), "application/octet-stream");

    const app = makeWebdavApp({ persist });

    const req = new Request("http://localhost/folder/", {
      method: "PROPFIND",
      headers: { Depth: "1" },
    });
    const res = await app.request(req);
    expect(res.status).toBe(207);
    const body = await res.text();

    expect(body).toContain("<D:href>/folder/visible.md</D:href>");
    expect(body).not.toContain("<D:href>/folder/._hidden</D:href>");
    expect(body).not.toContain("<D:href>/folder/.AppleDouble</D:href>");
  });
});
