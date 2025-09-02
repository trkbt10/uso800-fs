/**
 * @file Server-level tests to verify UA-driven compat policies are effective.
 */
import { makeWebdavApp } from "../server";
import { createMemoryAdapter } from "../persist/memory";
import { finderDialect } from "./finder";
import { windowsWebClientDialect } from "./windows";
import { linuxGvfsDialect } from "./linux";
import { composeDialects } from "./types";

async function mkcol(app: ReturnType<typeof makeWebdavApp>, path: string): Promise<void> {
  const res = await app.request(new Request(`http://localhost${path}`, { method: "MKCOL" }));
  expect([201, 405]).toContain(res.status);
}

async function moveWithoutDepth(
  app: ReturnType<typeof makeWebdavApp>,
  src: string,
  dst: string,
  ua: string,
): Promise<Response> {
  return await app.request(new Request(`http://localhost${src}`, {
    method: "MOVE",
    headers: { Destination: `http://localhost${dst}`, "User-Agent": ua },
  }));
}

describe("UA-driven compat policies (server integration)", () => {
  it("finderDialect relaxes MOVE without Depth for Finder UA only", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, dialect: finderDialect() });
    await mkcol(app, "/dir");

    const ok = await moveWithoutDepth(app, "/dir", "/dir2", "WebDAVFS/3.0 (Darwin) CFNetwork");
    expect([201, 204]).toContain(ok.status);

    await mkcol(app, "/dir3");
    const bad = await moveWithoutDepth(app, "/dir3", "/dir4", "curl/8.0");
    expect(bad.status).toBe(400);
  });

  it("windowsWebClientDialect relaxes for Microsoft-WebDAV-MiniRedir only", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, dialect: windowsWebClientDialect() });
    await mkcol(app, "/w1");

    const ok = await moveWithoutDepth(app, "/w1", "/w2", "Microsoft-WebDAV-MiniRedir/10.0.22621");
    expect([201, 204]).toContain(ok.status);

    await mkcol(app, "/w3");
    const bad = await moveWithoutDepth(app, "/w3", "/w4", "curl/8.0");
    expect(bad.status).toBe(400);
  });

  it("linuxGvfsDialect relaxes for gvfs/gio/cadaver/davfs2 only", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, dialect: linuxGvfsDialect() });
    await mkcol(app, "/l1");
    const ok1 = await moveWithoutDepth(app, "/l1", "/l2", "gvfs/1.50.0");
    expect([201, 204]).toContain(ok1.status);

    await mkcol(app, "/l3");
    const ok2 = await moveWithoutDepth(app, "/l3", "/l4", "cadaver/0.23.3");
    expect([201, 204]).toContain(ok2.status);

    await mkcol(app, "/l5");
    const ok3 = await moveWithoutDepth(app, "/l5", "/l6", "davfs2/1.6.1");
    expect([201, 204]).toContain(ok3.status);

    await mkcol(app, "/l7");
    const bad = await moveWithoutDepth(app, "/l7", "/l8", "curl/8.0");
    expect(bad.status).toBe(400);
  });

  it("composeDialects relaxes when any constituent policy matches", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist, dialect: composeDialects([finderDialect(), windowsWebClientDialect()]) });
    await mkcol(app, "/c1");
    const ok = await moveWithoutDepth(app, "/c1", "/c2", "Microsoft-WebDAV-MiniRedir/10.0.22621");
    expect([201, 204]).toContain(ok.status);

    await mkcol(app, "/c3");
    const ok2 = await moveWithoutDepth(app, "/c3", "/c4", "WebDAVFS/3.0 (Darwin)");
    expect([201, 204]).toContain(ok2.status);

    await mkcol(app, "/c5");
    const bad = await moveWithoutDepth(app, "/c5", "/c6", "curl/8.0");
    expect(bad.status).toBe(400);
  });
});
