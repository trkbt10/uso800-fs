/**
 * @file Unit tests for HTTP/WebDAV guard helpers
 */
import { createMemoryAdapter } from "./persist/memory";
import { createDavStateStore } from "./dav-state";
import {
  extractLockTokenFromIfHeader,
  requireLockOk,
  checkDepthInfinityRequiredForDir,
  etagMatchesIfHeader,
  computeWeakEtagFromStat,
} from "./http-guards";

describe("http-guards helpers", () => {
  it("extractLockTokenFromIfHeader parses token", () => {
    const token = extractLockTokenFromIfHeader("( <opaquelocktoken:abc> )");
    expect(token).toBe("opaquelocktoken:abc");
    const none = extractLockTokenFromIfHeader(undefined);
    expect(none).toBeUndefined();
  });

  it("requireLockOk validates Lock-Token and If headers", async () => {
    const persist = createMemoryAdapter();
    const dav = createDavStateStore(persist);
    await persist.writeFile(["a.txt"], new TextEncoder().encode("x"), "text/plain");
    await dav.setLock("/a.txt", "opaquelocktoken:xyz");
    const hdrs1 = new Headers();
    const ok1 = await requireLockOk(dav, "/a.txt", hdrs1, "Lock-Token");
    expect(ok1).toBe(false);
    const hdrs2 = new Headers({ "Lock-Token": "opaquelocktoken:xyz" });
    const ok2 = await requireLockOk(dav, "/a.txt", hdrs2, "Lock-Token");
    expect(ok2).toBe(true);
    const hdrs3 = new Headers({ If: "(<opaquelocktoken:xyz>)" });
    const ok3 = await requireLockOk(dav, "/a.txt", hdrs3, "Lock-Token");
    expect(ok3).toBe(true);
  });

  it("checkDepthInfinityRequiredForDir requires Depth: infinity for directories", async () => {
    const persist = createMemoryAdapter();
    await persist.ensureDir(["d"]);
    const allow1 = await checkDepthInfinityRequiredForDir(persist, "/d", () => "infinity");
    expect(allow1).toBe(true);
    const deny = await checkDepthInfinityRequiredForDir(persist, "/d", () => "1");
    expect(deny).toBe(false);
    await persist.writeFile(["f.txt"], new TextEncoder().encode("x"), "text/plain");
    const allow2 = await checkDepthInfinityRequiredForDir(persist, "/f.txt", () => null);
    expect(allow2).toBe(true);
  });

  it("etagMatchesIfHeader compares current ETag with If header", async () => {
    const persist = createMemoryAdapter();
    await persist.writeFile(["e.txt"], new TextEncoder().encode("abc"), "text/plain");
    const st = await persist.stat(["e.txt"]);
    const etag = computeWeakEtagFromStat(st);
    const h1 = new Headers();
    expect(await etagMatchesIfHeader(persist, "/e.txt", h1)).toBe(true);
    const h2 = new Headers({ If: "([\"nope\"])" });
    expect(await etagMatchesIfHeader(persist, "/e.txt", h2)).toBe(false);
    const h3 = new Headers({ If: `([${etag}])` });
    expect(await etagMatchesIfHeader(persist, "/e.txt", h3)).toBe(true);
  });
});
