/**
 * @file CalDAV REPORT calendar-multiget integration test via hooks
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: REPORT calendar-multiget", () => {
  it("returns requested hrefs with calendar-data", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));

    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:42\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nSUMMARY:Hello\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/a.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));
    await app.request(new Request("http://localhost/cal/b.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));

    const body = `<?xml version="1.0"?>
<C:calendar-multiget xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:href>/cal/a.ics</D:href>
  <D:href>/cal/b.ics</D:href>
</C:calendar-multiget>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", body }));
    expect(res.status).toBe(207);
    const xml = await res.text();
    expect(xml).toContain("/cal/a.ics");
    expect(xml).toContain("/cal/b.ics");
    expect(xml).toContain("calendar-data");
  });
});
