/** @file PROPFIND Brief/Prefer minimal compat tests */
import { makeWebdavApp } from "../../server";
import { createMemoryAdapter } from "../../persist/memory";

async function mk(app: ReturnType<typeof makeWebdavApp>, p: string) {
  await app.request(new Request(`http://localhost${p}`, { method: "MKCOL" }));
}

describe("PROPFIND Brief/Prefer minimal compat", () => {
  it("Brief: t removes 404 propstat", async () => {
    const app = makeWebdavApp({ persist: createMemoryAdapter() });
    await mk(app, "/d");
    const body = `<?xml version="1.0"><D:propfind xmlns:D="DAV:"><D:prop><D:lockdiscovery/><D:supportedlock/><D:unknown-prop/></D:prop></D:propfind>`;
    const r1 = await app.request(new Request("http://localhost/d", { method: "PROPFIND", headers: { Depth: "0" }, body }));
    const t1 = await r1.text();
    expect(t1).toMatch(/404 Not Found/);
    const r2 = await app.request(new Request("http://localhost/d", { method: "PROPFIND", headers: { Depth: "0", Brief: "t" }, body }));
    const t2 = await r2.text();
    expect(t2).not.toMatch(/404 Not Found/);
  });
});
