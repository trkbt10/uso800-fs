/**
 * @file ORDERPATCH unit test on memory adapter
 */
import { createMemoryAdapter } from "../persist/memory";
import { handleOrderpatchRequest } from "./orderpatch";
import { applyOrder } from "../order";

describe("ORDERPATCH unit (memory adapter)", () => {
  it("persists order and applyOrder returns the explicit order", async () => {
    const p = createMemoryAdapter();
    await p.ensureDir(["folder"]);
    await p.writeFile(["folder", "a.txt"], new TextEncoder().encode("a"), "text/plain");
    await p.writeFile(["folder", "b.txt"], new TextEncoder().encode("b"), "text/plain");
    await p.writeFile(["folder", "c.txt"], new TextEncoder().encode("c"), "text/plain");

    const body = `<?xml version="1.0"?><D:orderpatch xmlns:D="DAV:" xmlns:Z="urn:x"><Z:names><Z:name>c.txt</Z:name><Z:name>a.txt</Z:name><Z:name>b.txt</Z:name></Z:names></D:orderpatch>`;
    const res = await handleOrderpatchRequest("/folder", body, { persist: p });
    expect([200, 204]).toContain(res.response.status);

    const ordered = await applyOrder(p, "/folder", ["a.txt", "b.txt", "c.txt"]);
    expect(ordered).toEqual(["c.txt", "a.txt", "b.txt"]);
  });

  it("stores Z:order props for collection", async () => {
    const p = createMemoryAdapter();
    await p.ensureDir(["folder"]);
    const body = `<?xml version="1.0"?><D:orderpatch xmlns:D="DAV:" xmlns:Z="urn:x"><Z:names><Z:name>c.txt</Z:name><Z:name>a.txt</Z:name><Z:name>b.txt</Z:name></Z:names></D:orderpatch>`;
    const res = await handleOrderpatchRequest("/folder", body, { persist: p });
    expect([200, 204]).toContain(res.response.status);
    const { createDavStateStore } = await import("../dav-state");
    const store = createDavStateStore(p);
    const props = await store.getProps("/folder");
    expect(props["Z:order"]).toBe("c.txt,a.txt,b.txt");
  });
});
