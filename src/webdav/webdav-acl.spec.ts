/**
 * @file ACL basic enforcement tests using props-based method gates.
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";
import { createDavStateStore } from "./dav-state";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV ACL (basic)", () => {
  it("denies GET when Z:acl-deny-GET=true", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/a.txt", { method: "PUT", body: "x" }));
    const store = createDavStateStore(persist);
    await store.setProps("/a.txt", { "Z:acl-deny-GET": "true" });
    const res = await app.request(new Request("http://localhost/a.txt", { method: "GET" }));
    expect(res.status).toBe(403);
  });

  it("denies PUT when Z:acl-deny-PUT=true", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    const store = createDavStateStore(persist);
    await store.setProps("/b.txt", { "Z:acl-deny-PUT": "true" });
    const res = await app.request(new Request("http://localhost/b.txt", { method: "PUT", body: "y" }));
    expect(res.status).toBe(403);
  });

  it("parent directory deny(read) blocks GET for child", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/folder", { method: "MKCOL" }));
    await app.request(new Request("http://localhost/folder/a.txt", { method: "PUT", body: "x" }));
    const store = createDavStateStore(persist);
    await store.setProps("/folder", { "Z:acl-deny": "read" });
    const res = await app.request(new Request("http://localhost/folder/a.txt", { method: "GET" }));
    expect(res.status).toBe(403);
  });

  it("denies PROPFIND when Z:acl-deny-PROPFIND=true", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    const store = createDavStateStore(persist);
    await store.setProps("/", { "Z:acl-deny-PROPFIND": "true" });
    const res = await app.request(new Request("http://localhost/", { method: "PROPFIND", headers: { Depth: "0" } }));
    expect(res.status).toBe(403);
  });

  it("deny takes precedence over allow for same method", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/c.txt", { method: "PUT", body: "z" }));
    const store = createDavStateStore(persist);
    await store.setProps("/c.txt", { "Z:acl-deny-GET": "true", "Z:acl-allow-GET": "true" });
    const res = await app.request(new Request("http://localhost/c.txt", { method: "GET" }));
    expect(res.status).toBe(403);
    // Remove deny to allow
    await store.setProps("/c.txt", { "Z:acl-deny-GET": "false", "Z:acl-allow-GET": "true" });
    const res2 = await app.request(new Request("http://localhost/c.txt", { method: "GET" }));
    expect(res2.status).toBe(200);
    expect(await text(res2)).toBe("z");
  });
});
