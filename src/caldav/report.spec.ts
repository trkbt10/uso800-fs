/**
 * @file CalDAV REPORT minimal behavior via hooks
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: REPORT", () => {
  it("calendar-query returns 207 multistatus via hooks", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    const body = `<?xml version="1.0"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"/>`;
    const res = await app.request(new Request("http://localhost/cal", { method: "REPORT", body }));
    expect(res.status).toBe(207);
  });
});
