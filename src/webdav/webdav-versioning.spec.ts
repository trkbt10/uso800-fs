/**
 * @file WebDAV Versioning minimal integration tests
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV Versioning (minimal)", () => {
  it("records versions on PUT and REPORT returns version list", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/v.txt", { method: "PUT", body: "a" }));
    await app.request(new Request("http://localhost/v.txt", { method: "PUT", body: "ab" }));
    const body = `<?xml version="1.0"?><D:report xmlns:D="DAV:"><D:version-tree/></D:report>`;
    const rep = await app.request(new Request("http://localhost/v.txt", { method: "REPORT", body }));
    expect(rep.status).toBe(207);
    const xml = await text(rep);
    expect(xml).toContain("<Z:version-id>1</Z:version-id>");
    expect(xml).toContain("<Z:version-id>2</Z:version-id>");
  });

  it("GET with X-Version-Id returns specific snapshot", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/v2.txt", { method: "PUT", body: "first" }));
    await app.request(new Request("http://localhost/v2.txt", { method: "PUT", body: "second" }));
    const res1 = await app.request(new Request("http://localhost/v2.txt", { method: "GET", headers: { "X-Version-Id": "1" } }));
    expect(res1.status).toBe(200);
    expect(new TextDecoder().decode(await res1.arrayBuffer())).toBe("first");
    const res2 = await app.request(new Request("http://localhost/v2.txt", { method: "GET", headers: { "X-Version-Id": "2" } }));
    expect(new TextDecoder().decode(await res2.arrayBuffer())).toBe("second");
  });

  it("REPORT invalid body returns 400; empty versions returns 207 with no entries", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    // invalid body
    const bad = await app.request(new Request("http://localhost/n.txt", { method: "REPORT", body: "<nope/>" }));
    expect(bad.status).toBe(400);
    // empty versions on new resource path
    const body = `<?xml version="1.0"><D:report xmlns:D="DAV:"><D:version-tree/></D:report>`;
    const ok = await app.request(new Request("http://localhost/n.txt", { method: "REPORT", body }));
    expect(ok.status).toBe(207);
    const xml = await text(ok);
    // No <Z:version-id> entries expected
    expect(xml).not.toContain("<Z:version-id>");
  });
});
