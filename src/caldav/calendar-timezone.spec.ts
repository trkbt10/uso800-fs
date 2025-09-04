/**
 * @file CalDAV calendar-timezone default and PROPPATCH
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: calendar-timezone", () => {
  it("defaults to UTC and can be updated via PROPPATCH", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const pfBody = `<?xml version="1.0"><D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-timezone/></D:prop></D:propfind>`;
    const pf = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body: pfBody }));
    expect((await text(pf))).toContain("UTC");

    const ppBody = `<?xml version="1.0"><D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:set><D:prop><C:calendar-timezone>Asia/Tokyo</C:calendar-timezone></D:prop></D:set></D:propertyupdate>`;
    const pr = await app.request(new Request("http://localhost/cal", { method: "PROPPATCH", headers: { "Content-Type": "application/xml" }, body: ppBody }));
    expect(pr.status).toBe(207);
    const pf2 = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body: pfBody }));
    expect((await text(pf2))).toContain("Asia/Tokyo");
  });
});
