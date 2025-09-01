/**
 * @file WebDAV ORDERPATCH minimal behavior
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

async function text(res: Response): Promise<string> { return await res.text(); }

function orderOf(xml: string, names: string[]): number[] {
  return names.map((n) => xml.indexOf(`>${encodeURIComponent(n)}<`));
}

describe("WebDAV ORDERPATCH (minimal)", () => {
  it("applies explicit order to PROPFIND depth=1 and GET listing", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/folder", { method: "MKCOL" }));
    await app.request(new Request("http://localhost/folder/a.txt", { method: "PUT", body: "a" }));
    await app.request(new Request("http://localhost/folder/b.txt", { method: "PUT", body: "b" }));
    await app.request(new Request("http://localhost/folder/c.txt", { method: "PUT", body: "c" }));
    const body = `<?xml version="1.0"?><D:orderpatch xmlns:D="DAV:" xmlns:Z="urn:x"><Z:names><Z:name>c.txt</Z:name><Z:name>a.txt</Z:name><Z:name>b.txt</Z:name></Z:names></D:orderpatch>`;
    const ord = await app.request(new Request("http://localhost/folder", { method: "ORDERPATCH", body }));
    expect([200, 204]).toContain(ord.status);

    const res = await app.request(new Request("http://localhost/folder", { method: "PROPFIND", headers: { Depth: "1" } }));
    const xml = await text(res);
    const idx = orderOf(xml, ["c.txt", "a.txt", "b.txt"]);
    expect(idx[0]).toBeLessThan(idx[1]);
    expect(idx[1]).toBeLessThan(idx[2]);

    const page = await app.request(new Request("http://localhost/folder/", { method: "GET" }));
    const html = await text(page);
    const p1 = html.indexOf(">c.txt<");
    const p2 = html.indexOf(">a.txt<");
    const p3 = html.indexOf(">b.txt<");
    expect(p1).toBeGreaterThan(0);
    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThan(p3);
  });
});

