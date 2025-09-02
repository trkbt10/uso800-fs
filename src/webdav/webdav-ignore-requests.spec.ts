/**
 * @file Ensure ignored paths do not produce listings and return 404.
 */

// Use global describe/it/expect
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

describe("Ignored path requests", () => {
  it("returns 404 for PROPFIND to ignored metadata path", async () => {
    const persist = createMemoryAdapter();
    // Place an ignored file at root
    await persist.writeFile(["._._rune_of_chai.txt"], new Uint8Array(), "application/octet-stream");
    const app = makeWebdavApp({ persist });

    const res = await app.request(new Request("http://localhost/._._rune_of_chai.txt/", { method: "PROPFIND", headers: { Depth: "1" } }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for GET to ignored metadata path", async () => {
    const persist = createMemoryAdapter();
    await persist.writeFile(["._shadow"], new Uint8Array(), "application/octet-stream");
    const app = makeWebdavApp({ persist });

    const res = await app.request(new Request("http://localhost/._shadow", { method: "GET" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for PROPFIND to macOS indexing blocker", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    const res = await app.request(new Request("http://localhost/.metadata_never_index_unless_ro", { method: "PROPFIND", headers: { Depth: "1" } }));
    expect(res.status).toBe(404);
  });
});
