/**
 * @file QUOTA integration tests: properties and basic enforcement.
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";
import { createDavStateStore } from "./dav-state";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV QUOTA (basic)", () => {
  it("reports quota-used-bytes and quota-available-bytes when limit is set", async () => {
    const persist = createMemoryAdapter();
    const store = createDavStateStore(persist);
    await store.setProps("/", { "Z:quota-limit-bytes": String(5) });
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/a.txt", { method: "PUT", body: "xxx" }));
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:quota-used-bytes/><D:quota-available-bytes/></D:prop></D:propfind>`;
    const res = await app.request(new Request("http://localhost/", { method: "PROPFIND", headers: { Depth: "0" }, body }));
    const xml = await text(res);
    expect(xml).toContain("<D:quota-used-bytes>3</D:quota-used-bytes>");
    expect(xml).toContain("<D:quota-available-bytes>2</D:quota-available-bytes>");
  });

  it("PUT exceeding quota returns 507 Insufficient Storage", async () => {
    const persist = createMemoryAdapter();
    const store = createDavStateStore(persist);
    await store.setProps("/", { "Z:quota-limit-bytes": String(5) });
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/a.txt", { method: "PUT", body: "xxx" }));
    const res = await app.request(new Request("http://localhost/b.txt", { method: "PUT", body: "xxxx" }));
    expect(res.status).toBe(507);
  });
});

