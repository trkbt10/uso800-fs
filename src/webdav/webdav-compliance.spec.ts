/**
 * @file Compliance-style integration tests to guard protocol behaviors.
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("WebDAV compliance (basic)", () => {
  it("PROPFIND prop: unknown properties produce 404 propstat", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/f.txt", { method: "PUT", body: "x" }));
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:getcontentlength/><Z:unknown xmlns:Z="urn:x"/></D:prop></D:propfind>`;
    const res = await app.request(new Request("http://localhost/f.txt", { method: "PROPFIND", headers: { Depth: "0" }, body }));
    expect(res.status).toBe(207);
    const xml = await text(res);
    expect(xml).toContain("404 Not Found");
    expect(xml).toContain("<Z:unknown");
    expect(xml).toContain("getcontentlength");
  });

  it("PROPPATCH: remove non-existing yields 404 propstat alongside 200", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/p.txt", { method: "PUT", body: "x" }));
    const setBody = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:x"><D:set><D:prop><Z:a>1</Z:a></D:prop></D:set></D:propertyupdate>`;
    await app.request(new Request("http://localhost/p.txt", { method: "PROPPATCH", body: setBody }));
    const rmBody = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:x"><D:remove><D:prop><Z:a/><Z:b/></D:prop></D:remove></D:propertyupdate>`;
    const res = await app.request(new Request("http://localhost/p.txt", { method: "PROPPATCH", body: rmBody }));
    const xml = await text(res);
    expect(xml).toContain("200 OK");
    expect(xml).toContain("404 Not Found");
  });

  it("COPY/MOVE dir require Depth: infinity", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/dir", { method: "MKCOL" }));
    // MOVE without Depth is 400
    const resMoveNoDepth = await app.request(new Request("http://localhost/dir", { method: "MOVE", headers: { Destination: "http://localhost/dir2" } }));
    expect(resMoveNoDepth.status).toBe(400);
    // COPY without Depth is 400
    const resCopyNoDepth = await app.request(new Request("http://localhost/dir", { method: "COPY", headers: { Destination: "http://localhost/dir3" } }));
    expect(resCopyNoDepth.status).toBe(400);
    // With Depth: infinity works
    const resMoveWithDepth = await app.request(new Request("http://localhost/dir", { method: "MOVE", headers: { Destination: "http://localhost/dir2", Depth: "infinity" } }));
    expect([201, 204]).toContain(resMoveWithDepth.status);
  });

  it("PROPPATCH requires lock token when locked", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/l.txt", { method: "PUT", body: "x" }));
    const lockRes = await app.request(new Request("http://localhost/l.txt", { method: "LOCK" }));
    const token = lockRes.headers.get("Lock-Token");
    const setBody = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:x"><D:set><D:prop><Z:a>1</Z:a></D:prop></D:set></D:propertyupdate>`;
    // without token
    const resNoToken = await app.request(new Request("http://localhost/l.txt", { method: "PROPPATCH", body: setBody }));
    expect(resNoToken.status).toBe(423);
    // with token
    const resWithToken = await app.request(new Request("http://localhost/l.txt", { method: "PROPPATCH", headers: { "Lock-Token": token! }, body: setBody }));
    expect(resWithToken.status).toBe(207);
  });
});
