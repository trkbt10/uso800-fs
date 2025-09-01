/**
 * @file Unit tests for QUOTA helpers
 */
import { createMemoryAdapter } from "./persist/memory";
import { createDavStateStore } from "./dav-state";
import { getQuotaLimitBytes, getAvailableBytes } from "./quota";

describe("quota helpers", () => {
  it("returns null when limit is not set or invalid", async () => {
    const persist = createMemoryAdapter();
    expect(await getQuotaLimitBytes(persist)).toBeNull();
    const store = createDavStateStore(persist);
    await store.setProps("/", { "Z:quota-limit-bytes": "not-a-number" });
    expect(await getQuotaLimitBytes(persist)).toBeNull();
  });

  it("getAvailableBytes clamps at zero when used exceeds limit", async () => {
    const persist = createMemoryAdapter();
    const store = createDavStateStore(persist);
    await store.setProps("/", { "Z:quota-limit-bytes": String(2) });
    await persist.writeFile(["a.txt"], new TextEncoder().encode("abcd"), "text/plain");
    const avail = await getAvailableBytes(persist);
    expect(avail).toBe(0);
  });
});

