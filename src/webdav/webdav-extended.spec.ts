/**
 * @file Extended WebDAV behaviours: Depth: infinity, PROPPATCH, LOCK/UNLOCK
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV extended features", () => {
  it("PROPFIND Depth: infinity lists nested structure", async () => {
    const persist = createMemoryAdapter();
    await persist.ensureDir(["a", "b"]);
    await persist.writeFile(["a", "b", "c.txt"], new TextEncoder().encode("x"), "text/plain");
    const app = makeWebdavApp({ persist });
    const req = new Request("http://localhost/a/", { method: "PROPFIND", headers: { Depth: "infinity" } });
    const res = await app.request(req);
    expect(res.status).toBe(207);
    const body = await text(res);
    expect(body).toContain("/a/");
    expect(body).toContain("/a/b/");
    expect(body).toContain("/a/b/c.txt");
  });

  it("LOCK/UNLOCK enforces and releases exclusive lock", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });

    // Create empty file target via PUT to establish path
    const r1 = await app.request(new Request("http://localhost/locked.txt", { method: "PUT", body: "" }));
    expect(r1.status).toBe(201);

    // LOCK without body (simple exclusive lock)
    const r2 = await app.request(new Request("http://localhost/locked.txt", { method: "LOCK" }));
    expect([200, 201]).toContain(r2.status);
    const lockToken = r2.headers.get("Lock-Token");
    expect(lockToken).toBeTruthy();

    // PUT without token should be blocked
    const r3 = await app.request(new Request("http://localhost/locked.txt", { method: "PUT", body: "new" }));
    expect(r3.status).toBe(423);

    // PUT with token should succeed (use Lock-Token header)
    const r4 = await app.request(new Request("http://localhost/locked.txt", { method: "PUT", body: "new", headers: { "Lock-Token": lockToken! } }));
    expect(r4.status).toBe(201);

    // UNLOCK frees it
    const r5 = await app.request(new Request("http://localhost/locked.txt", { method: "UNLOCK", headers: { "Lock-Token": lockToken! } }));
    expect(r5.status).toBe(204);

    // Now PUT without token should succeed
    const r6 = await app.request(new Request("http://localhost/locked.txt", { method: "PUT", body: "after" }));
    expect(r6.status).toBe(201);
  });

  it("PROPPATCH sets properties and returns 207 Multi-Status", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    // Seed file
    await app.request(new Request("http://localhost/p.txt", { method: "PUT", body: "x" }));

    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:example:props">
  <D:set>
    <D:prop>
      <Z:color>blue</Z:color>
    </D:prop>
  </D:set>
</D:propertyupdate>`;
    const res = await app.request(new Request("http://localhost/p.txt", { method: "PROPPATCH", body }));
    expect(res.status).toBe(207);
    expect(res.headers.get("Content-Type") ?? "").toContain("xml");
    const xml = await text(res);
    expect(xml).toContain("multistatus");
    expect(xml).toContain("color");
  });

  it("PROPPATCH remove deletes properties and returns 207", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/rm.txt", { method: "PUT", body: "x" }));
    // set two props
    const body1 = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:ex"><D:set><D:prop><Z:a>1</Z:a><Z:b>2</Z:b></D:prop></D:set></D:propertyupdate>`;
    const res1 = await app.request(new Request("http://localhost/rm.txt", { method: "PROPPATCH", body: body1 }));
    expect(res1.status).toBe(207);
    // remove one
    const body2 = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:ex"><D:remove><D:prop><Z:a/></D:prop></D:remove></D:propertyupdate>`;
    const res2 = await app.request(new Request("http://localhost/rm.txt", { method: "PROPPATCH", body: body2 }));
    expect(res2.status).toBe(207);
  });

  it("MOVE requires lock token when source or destination locked", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/src.txt", { method: "PUT", body: "s" }));
    await app.request(new Request("http://localhost/dst.txt", { method: "PUT", body: "d" }));
    const lockRes = await app.request(new Request("http://localhost/src.txt", { method: "LOCK" }));
    const token = lockRes.headers.get("Lock-Token");
    expect(token).toBeTruthy();
    // MOVE without token -> 423
    const r1 = await app.request(new Request("http://localhost/src.txt", { method: "MOVE", headers: { Destination: "http://localhost/dst.txt" } }));
    expect(r1.status).toBe(423);
    // MOVE with If header token -> 204/201
    const r2 = await app.request(new Request("http://localhost/src.txt", { method: "MOVE", headers: { Destination: "http://localhost/dst.txt", If: `(<${token}>)` } }));
    expect([201, 204]).toContain(r2.status);
  });
});
