/**
 * @file CalDAV PROPPATCH + PROPFIND for calendar-description
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: calendar-description property", () => {
  it("PROPPATCH sets calendar-description and PROPFIND returns it", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });

    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <C:calendar-description>My Calendar</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>`;
    const pr = await app.request(new Request("http://localhost/cal", { method: "PROPPATCH", headers: { "Content-Type": "application/xml" }, body }));
    expect(pr.status).toBe(207);

    const pfBody = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-description/></D:prop></D:propfind>`;
    const pf = await app.request(new Request("http://localhost/cal", { method: "PROPFIND", body: pfBody }));
    expect(pf.status).toBe(207);
    const xml = await text(pf);
    expect(xml).toContain("calendar-description");
    expect(xml).toContain("My Calendar");
  });
});

