/**
 * @file WebDAV SEARCH minimal tests
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV SEARCH (basic contains)", () => {
  it("returns 207 with hrefs matching contains()", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/dir", { method: "MKCOL" }));
    await app.request(new Request("http://localhost/dir/foo.txt", { method: "PUT", body: "x" }));
    await app.request(new Request("http://localhost/dir/bar.txt", { method: "PUT", body: "y" }));
    const body = `<?xml version="1.0"?><D:query xmlns:D="DAV:"><D:contains>foo</D:contains></D:query>`;
    const res = await app.request(new Request("http://localhost/dir/", { method: "SEARCH", body }));
    expect(res.status).toBe(207);
    const xml = await text(res);
    expect(xml).toContain("/dir/foo.txt");
    expect(xml).not.toContain("/dir/bar.txt");
  });

  it("returns 404 for SEARCH on non-existent path", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    const body = `<?xml version="1.0"?><D:query xmlns:D="DAV:"><D:contains>x</D:contains></D:query>`;
    const res = await app.request(new Request("http://localhost/missing/", { method: "SEARCH", body }));
    expect(res.status).toBe(404);
  });

  it("without contains returns all files", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/dir", { method: "MKCOL" }));
    await app.request(new Request("http://localhost/dir/x.txt", { method: "PUT", body: "x" }));
    await app.request(new Request("http://localhost/dir/y.txt", { method: "PUT", body: "y" }));
    const body = `<?xml version="1.0"?><D:query xmlns:D="DAV:"></D:query>`;
    const res = await app.request(new Request("http://localhost/dir/", { method: "SEARCH", body }));
    const xml = await text(res);
    expect(xml).toContain("/dir/x.txt");
    expect(xml).toContain("/dir/y.txt");
  });
});
