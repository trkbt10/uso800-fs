/**
 * @file CalDAV MKCALENDAR minimal behavior
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: MKCALENDAR", () => {
  it("creates a calendar collection and PROPFIND shows C:calendar in resourcetype", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });

    const mkCalRes = await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    expect(mkCalRes.status).toBe(201);

    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
  </D:prop>
  </D:propfind>`;
    const pfRes = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body }));
    expect(pfRes.status).toBe(207);
    const xml = await text(pfRes);
    expect(xml).toContain("resourcetype");
    expect(xml).toContain("calendar");
  });
});
