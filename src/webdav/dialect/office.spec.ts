/** @file Office dialect tests for PROPPATCH lock token absorption */
import { makeWebdavApp } from "../server";
import { createMemoryAdapter } from "../persist/memory";
import { officeDialect } from "./office";

describe("Office dialect: PROPPATCH without lock token", () => {
  it("allows PROPPATCH without Lock-Token for Microsoft Office UA", async () => {
    const app = makeWebdavApp({ persist: createMemoryAdapter(), dialect: officeDialect() });
    // Create file
    await app.request(new Request("http://localhost/f.txt", { method: "PUT", body: new TextEncoder().encode("x") }));
    // Lock it
    const lockRes = await app.request(new Request("http://localhost/f.txt", { method: "LOCK" }));
    expect(lockRes.status).toBe(200);
    // PROPPATCH without Lock-Token, Office UA
    const body = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:"><D:set><D:prop><Z:Dummy xmlns:Z="urn:ms">1</Z:Dummy></D:prop></D:set></D:propertyupdate>`;
    const pr = await app.request(new Request("http://localhost/f.txt", { method: "PROPPATCH", headers: { "User-Agent": "Microsoft Office", "Content-Type": "application/xml" }, body }));
    expect(pr.status).toBe(207);
  });

  it("requires Lock-Token for non-Office UA", async () => {
    const app = makeWebdavApp({ persist: createMemoryAdapter(), dialect: officeDialect() });
    await app.request(new Request("http://localhost/g.txt", { method: "PUT", body: new TextEncoder().encode("x") }));
    const lockRes = await app.request(new Request("http://localhost/g.txt", { method: "LOCK" }));
    expect(lockRes.status).toBe(200);
    const body = `<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:"><D:set><D:prop><Z:Dummy xmlns:Z="urn:ms">1</Z:Dummy></D:prop></D:set></D:propertyupdate>`;
    const pr = await app.request(new Request("http://localhost/g.txt", { method: "PROPPATCH", headers: { "User-Agent": "curl/8.0", "Content-Type": "application/xml" }, body }));
    expect(pr.status).toBe(423);
  });
});
