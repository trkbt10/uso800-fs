/**
 * @file CalDAV OPTIONS advertising via hooks
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

describe("CalDAV: OPTIONS advertises calendar-access and MKCALENDAR", () => {
  it("adds calendar-access to DAV and MKCALENDAR to Allow", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    const res = await app.request(new Request("http://localhost/", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    const dav = res.headers.get("DAV") ?? "";
    const allow = res.headers.get("Allow") ?? "";
    expect(dav).toContain("calendar-access");
    expect(allow.toUpperCase()).toContain("MKCALENDAR");
  });
});

