/** @file PROPFIND lock props minimal completion tests */
import { makeWebdavApp } from "../../server";
import { createMemoryAdapter } from "../../persist/memory";

describe("PROPFIND lock props minimal completion", () => {
  it("returns minimal supportedlock/lockdiscovery instead of 404", async () => {
    const app = makeWebdavApp({ persist: createMemoryAdapter() });
    await app.request(new Request("http://localhost/file.txt", { method: "PUT", body: new TextEncoder().encode("x") }));
    const body = `<?xml version="1.0"><D:propfind xmlns:D="DAV:"><D:prop><D:supportedlock/><D:lockdiscovery/></D:prop></D:propfind>`;
    const r = await app.request(new Request("http://localhost/file.txt", { method: "PROPFIND", headers: { Depth: "0" }, body }));
    expect(r.status).toBe(207);
    const xml = await r.text();
    expect(xml).toMatch(/<D:supportedlock>[\s\S]*<D:lockentry>[\s\S]*<D:exclusive\/>[\s\S]*<D:write\/>[\s\S]*<\/D:lockentry>[\s\S]*<\/D:supportedlock>/);
    expect(xml).toMatch(/<D:lockdiscovery\/>/);
    expect(xml).not.toMatch(/404 Not Found/);
  });
});
