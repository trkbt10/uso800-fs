/**
 * @file CalDAV PUT validation under calendar collection
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: PUT under calendar", () => {
  it("rejects non-ics files in calendar collection", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const bad = await app.request(new Request("http://localhost/cal/notes.txt", { method: "PUT", body: "x" }));
    expect(bad.status).toBe(415);
  });

  it("accepts .ics text/calendar", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20250101T000000Z\nDTEND:20250101T010000Z\nSUMMARY:OK\nEND:VEVENT\nEND:VCALENDAR`;
    const ok = await app.request(new Request("http://localhost/cal/ok.ics", { method: "PUT", headers: { "Content-Type": "text/calendar" }, body: ics }));
    expect([200,201,204]).toContain(ok.status);
  });
});

