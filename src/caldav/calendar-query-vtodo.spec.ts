/**
 * @file CalDAV REPORT calendar-query VTODO support
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: calendar-query VTODO", () => {
  it("returns VTODO by comp-filter name VTODO", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const ics = `BEGIN:VCALENDAR\nBEGIN:VTODO\nUID:3\nDUE:20250102T000000Z\nSUMMARY:Do it\nEND:VTODO\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/todo.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp-filter name="VTODO"/></C:calendar-query>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", headers: { Depth: "1" }, body }));
    expect(res.status).toBe(207);
    const xml = await res.text();
    expect(xml).toContain("/cal/todo.ics");
  });
});
