/**
 * @file CalDAV calendar-query prop-filter/param-filter/text-match tests
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: calendar-query prop/param filter", () => {
  it("prop-filter text-match on SUMMARY", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nSUMMARY:Team Meeting\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/a.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp-filter name="VEVENT"><C:prop-filter name="SUMMARY"><C:text-match>meeting</C:text-match></C:prop-filter></C:comp-filter></C:calendar-query>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", body }));
    expect(res.status).toBe(207);
    const xml = await text(res);
    expect(xml.toLowerCase()).toContain("a.ics");
  });

  it("param-filter matches ATTENDEE CN", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:2\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nATTENDEE;CN=Alice:mailto:alice@example.com\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/b.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp-filter name="VEVENT"><C:prop-filter name="ATTENDEE"><C:param-filter name="CN"><C:text-match>Alice</C:text-match></C:param-filter></C:prop-filter></C:comp-filter></C:calendar-query>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", body }));
    expect(res.status).toBe(207);
    const xml = await text(res);
    expect(xml).toContain("/cal/b.ics");
  });

  it("is-not-defined works for missing property", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:3\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nEND:VEVENT\nEND:VCALENDAR`;
    await app.request(new Request("http://localhost/cal/c.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp-filter name="VEVENT"><C:prop-filter name="SUMMARY"><C:is-not-defined/></C:prop-filter></C:comp-filter></C:calendar-query>`;
    const res = await app.request(new Request("http://localhost/cal/", { method: "REPORT", body }));
    expect(res.status).toBe(207);
    const xml = await text(res);
    expect(xml).toContain("/cal/c.ics");
  });
});

