/**
 * @file Unit tests for CalDAV report handlers and dispatcher
 */
import { createMemoryAdapter } from "../webdav/persist/memory";
import { dispatchCalDavReport } from "./report-handlers";

describe("CalDAV report handlers (unit)", () => {
  it("calendar-multiget returns only existing hrefs", async () => {
    const p = createMemoryAdapter();
    await p.ensureDir(["cal"]);
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nEND:VEVENT\nEND:VCALENDAR`;
    await p.writeFile(["cal","a.ics"], new TextEncoder().encode(ics), "text/calendar");
    const body = `<?xml version="1.0"?><C:calendar-multiget xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:"><D:href>/cal/a.ics</D:href><D:href>/cal/missing.ics</D:href></C:calendar-multiget>`;
    const xml = await dispatchCalDavReport("/cal/", body, p);
    expect(xml).toContain("/cal/a.ics");
    expect(xml).not.toContain("/cal/missing.ics");
  });

  it("calendar-query without comp-filter matches by time when within range", async () => {
    const p = createMemoryAdapter();
    await p.ensureDir(["cal"]);
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nEND:VEVENT\nEND:VCALENDAR`;
    await p.writeFile(["cal","a.ics"], new TextEncoder().encode(ics), "text/calendar");
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:time-range start="20250101T000000Z" end="20250131T235959Z"/></C:calendar-query>`;
    const xml = await dispatchCalDavReport("/cal/", body, p);
    expect(xml).toContain("/cal/a.ics");
  });

  it("calendar-query with non-VEVENT comp-filter returns none (minimal support)", async () => {
    const p = createMemoryAdapter();
    await p.ensureDir(["cal"]);
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nEND:VEVENT\nEND:VCALENDAR`;
    await p.writeFile(["cal","a.ics"], new TextEncoder().encode(ics), "text/calendar");
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp-filter name="VTODO"/></C:calendar-query>`;
    const xml = await dispatchCalDavReport("/cal/", body, p);
    // Only multistatus with no responses
    expect(xml).toContain("multistatus");
    expect(xml).not.toContain("/cal/a.ics");
  });

  it("unknown report returns empty multistatus", async () => {
    const p = createMemoryAdapter();
    const body = `<?xml version="1.0"?><C:unknown xmlns:C="urn:ietf:params:xml:ns:caldav"/>`;
    const xml = await dispatchCalDavReport("/cal/", body, p);
    expect(xml).toContain("multistatus");
  });
});

