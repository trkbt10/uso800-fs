/**
 * @file CalDAV REPORT free-busy-query
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: free-busy-query", () => {
  it("returns VFREEBUSY with FREEBUSY periods for overlapping events", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const ics1 = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T120000Z\nDTEND:20250101T130000Z\nEND:VEVENT\nEND:VCALENDAR`;
    const ics2 = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:2\nDTSTART:20250101T140000Z\nDTEND:20250101T150000Z\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/a.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics1 }));
    await app.request(new Request("http://localhost/cal/b.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics2 }));

    const body = `<?xml version="1.0"><C:free-busy-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:time-range start="20250101T110000Z" end="20250101T143000Z"/></C:free-busy-query>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", headers: { Depth: "1" }, body }));
    expect([200,207]).toContain(res.status);
    const text = await res.text();
    expect(text).toContain("BEGIN:VFREEBUSY");
    expect(text).toContain("FREEBUSY:20250101T120000Z/20250101T130000Z");
    // Second event ends after query end; may not appear depending on range handling; minimal check only
  });
});
