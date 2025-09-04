/**
 * @file PROPFIND propname mode shows CalDAV injected props
 */
import { makeWebdavApp } from "../webdav/server";
import { createMemoryAdapter } from "../webdav/persist/memory";
import { createCalDavHooks } from "./hooks";

async function text(res: Response): Promise<string> { return await res.text(); }

describe("CalDAV: PROPFIND propname", () => {
  it("includes calendar component/data support props", async () => {
    const persist = createMemoryAdapter();
    const cal = createCalDavHooks();
    const app = makeWebdavApp({ persist, hooks: cal.hooks, customMethods: cal.customMethods });
    await app.request(new Request("http://localhost/cal", { method: "MKCALENDAR" }));
    const body = `<?xml version="1.0"?><D:propname xmlns:D="DAV:"/>`;
    const pf = await app.request(new Request("http://localhost/cal/", { method: "PROPFIND", body }));
    expect(pf.status).toBe(207);
    const xml = await text(pf);
    // Injected block includes these props
    expect(xml).toContain("supported-calendar-component-set");
    expect(xml).toContain("supported-calendar-data");
  });
});

