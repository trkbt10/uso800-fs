/**
 * @file Unit tests for DAV state store (locks, props)
 */
import { createDavStateStore } from "./dav-state";
import { createMemoryAdapter } from "./persist/memory";

describe("DAV state store", () => {
  it("sets/gets/releases lock with token match", async () => {
    const persist = createMemoryAdapter();
    const store = createDavStateStore(persist);
    const path = "/locked.txt";
    expect(await store.getLock(path)).toBeNull();
    await store.setLock(path, "t1");
    const rec = await store.getLock(path);
    expect(rec?.token).toBe("t1");
    // wrong token does not release
    const bad = await store.releaseLock(path, "t2");
    expect(bad).toBe(false);
    // correct token releases
    const ok = await store.releaseLock(path, "t1");
    expect(ok).toBe(true);
    expect(await store.getLock(path)).toBeNull();
  });

  it("merges and retrieves props", async () => {
    const persist = createMemoryAdapter();
    const store = createDavStateStore(persist);
    const p = "/x";
    expect(await store.getProps(p)).toEqual({});
    await store.mergeProps(p, { a: "1" });
    await store.mergeProps(p, { b: "2" });
    const props = await store.getProps(p);
    expect(props).toEqual({ a: "1", b: "2" });
  });
});

