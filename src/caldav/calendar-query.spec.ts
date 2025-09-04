/**
 * @file CalDAV REPORT calendar-query integration test via hooks
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: REPORT calendar-query", () => {
  it("filters VEVENT by time-range and returns calendar-data", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });

    // Create calendar collection
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));

    // Add iCalendar files
    const ics1 = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T120000Z\nDTEND:20250101T130000Z\nSUMMARY:Event 1\nEND:VEVENT\nEND:VCALENDAR`;
    const ics2 = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:2\nDTSTART:20260101T120000Z\nDTEND:20260101T130000Z\nSUMMARY:Event 2\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/e1.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics1 }));
    await app.request(new Request("http://localhost/cal/e2.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics2 }));

    // Query for 2025 only
    const body = `<?xml version="1.0"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
  <C:comp-filter name="VCALENDAR">
    <C:comp-filter name="VEVENT">
      <C:time-range start="20250101T000000Z" end="20250131T235959Z"/>
    </C:comp-filter>
  </C:comp-filter>
</C:calendar-query>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", body }));
    expect(res.status).toBe(207);
    const xml = await res.text();
    expect(xml).toContain("/cal/e1.ics");
    expect(xml).not.toContain("/cal/e2.ics");
    expect(xml).toContain("calendar-data");
  });
});
