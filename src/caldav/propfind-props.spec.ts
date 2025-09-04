/**
 * @file CalDAV PROPFIND property augmentation via hooks
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: PROPFIND properties", () => {
  it("returns C:supported-calendar-component-set and C:supported-calendar-data for calendar collections", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });

    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const body = `<?xml version="1.0"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:supported-calendar-component-set/>
    <C:supported-calendar-data/>
  </D:prop>
</D:propfind>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body }));
    expect(res.status).toBe(207);
    const xml = await text(res);
    expect(xml).toContain("supported-calendar-component-set");
    expect(xml).toContain("supported-calendar-data");
  });
});
