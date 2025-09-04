/**
 * @file CalDAV REPORT calendar-query with Depth handling
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: calendar-query Depth handling", () => {
  it("Depth: infinity searches nested subfolders", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });

    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    await persist.ensureDir(["cal","sub"]);
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/sub/nested.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));

    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"/></C:comp-filter></C:calendar-query>`;
    const res1 = await app.request(new Request("http://localhost/cal/", { method: "REPORT", headers: { Depth: "infinity" }, body }));
    expect(res1.status).toBe(207);
    expect(await text(res1)).toContain("nested.ics");

    const res2 = await app.request(new Request("http://localhost/cal/", { method: "REPORT", headers: { Depth: "1" }, body }));
    expect(res2.status).toBe(207);
    expect(await text(res2)).not.toContain("nested.ics");
  });
});

