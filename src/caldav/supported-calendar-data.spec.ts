/**
 * @file CalDAV supported-calendar-data returns version=2.0
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: supported-calendar-data", () => {
  it("includes version=2.0", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const body = `<?xml version="1.0"><D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:supported-calendar-data/></D:prop></D:propfind>`;
    const pf = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body }));
    const xml = await text(pf);
    expect(xml).toContain("supported-calendar-data");
    expect(xml).toContain("version=\"2.0\"");
  });
});
