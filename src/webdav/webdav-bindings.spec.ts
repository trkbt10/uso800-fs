/**
 * @file WebDAV BIND/UNBIND/REBIND minimal behavior tests
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV Bindings (minimal)", () => {
  it("BIND copies content from Source to request path", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/src.txt", { method: "PUT", body: "x" }));
    const res = await app.request(new Request("http://localhost/alias.txt", { method: "BIND", headers: { Source: "http://localhost/src.txt" } }));
    expect([201, 204]).toContain(res.status);
    const g = await app.request(new Request("http://localhost/alias.txt", { method: "GET" }));
    expect(await text(g)).toBe("x");
  });

  it("UNBIND removes the binding path (like DELETE)", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/file.txt", { method: "PUT", body: "y" }));
    const del = await app.request(new Request("http://localhost/file.txt", { method: "UNBIND" }));
    expect([204, 200, 404]).toContain(del.status);
    const g = await app.request(new Request("http://localhost/file.txt", { method: "GET" }));
    expect(g.status).toBe(404);
  });

  it("REBIND moves a resource (like MOVE)", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/a.txt", { method: "PUT", body: "z" }));
    const mv = await app.request(new Request("http://localhost/a.txt", { method: "REBIND", headers: { Destination: "http://localhost/b.txt" } }));
    expect([201, 204]).toContain(mv.status);
    const g1 = await app.request(new Request("http://localhost/b.txt", { method: "GET" }));
    expect(await text(g1)).toBe("z");
    const g2 = await app.request(new Request("http://localhost/a.txt", { method: "GET" }));
    expect(g2.status).toBe(404);
  });
});

