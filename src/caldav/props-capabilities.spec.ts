/**
 * @file CalDAV capability properties on calendar collection
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: capability properties", () => {
  it("PROPFIND returns max sizes, date ranges, instances, attendees", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const body = `<?xml version="1.0"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:max-resource-size/>
    <C:min-date-time/>
    <C:max-date-time/>
    <C:max-instances/>
    <C:max-attendees-per-instance/>
  </D:prop>
</D:propfind>`;
    const pf = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body }));
    expect(pf.status).toBe(207);
    const xml = await text(pf);
    expect(xml).toContain("max-resource-size");
    expect(xml).toContain("min-date-time");
    expect(xml).toContain("max-date-time");
    expect(xml).toContain("max-instances");
    expect(xml).toContain("max-attendees-per-instance");
  });
});

