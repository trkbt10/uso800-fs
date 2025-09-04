import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";
import { createDavStateStore } from "./dav-state";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("Server ORDERPATCH integration", () => {
  it("reorders PROPFIND depth=1 after ORDERPATCH", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/folder", { method: "MKCOL" }));
    await app.request(new Request("http://localhost/folder/a.txt", { method: "PUT", body: "a" }));
    await app.request(new Request("http://localhost/folder/b.txt", { method: "PUT", body: "b" }));
    await app.request(new Request("http://localhost/folder/c.txt", { method: "PUT", body: "c" }));
    const body = `<?xml version="1.0"?><D:orderpatch xmlns:D="DAV:" xmlns:Z="urn:x"><Z:names><Z:name>c.txt</Z:name><Z:name>a.txt</Z:name><Z:name>b.txt</Z:name></Z:names></D:orderpatch>`;
    const ord = await app.request(new Request("http://localhost/folder", { method: "ORDERPATCH", body }));
    expect([200, 204]).toContain(ord.status);
    const store = createDavStateStore(persist);
    const props = await store.getProps("/folder");
    expect(typeof props["Z:order"]).toBe("string");
    const res = await app.request(new Request("http://localhost/folder", { method: "PROPFIND", headers: { Depth: "1" } }));
    const xml = await text(res);
    // console.log(xml);
    const idxC = xml.indexOf(">c.txt<");
    const idxA = xml.indexOf(">a.txt<");
    const idxB = xml.indexOf(">b.txt<");
    expect(idxC).toBeGreaterThan(0);
    expect(idxC).toBeLessThan(idxA);
    expect(idxA).toBeLessThan(idxB);
  });
});
