import { createMemoryAdapter } from "../persist/memory";
import { setOrder, applyOrder } from "../order";
import { createDataLoaderAdapter } from "../persist/dataloader-adapter";

describe("ORDERPATCH adapter interplay", () => {
  it("applyOrder via DataLoaderAdapter sees order written via base", async () => {
    const base = createMemoryAdapter();
    await base.ensureDir(["folder"]);
    await base.writeFile(["folder","a.txt"], new TextEncoder().encode("a"), "text/plain");
    await base.writeFile(["folder","b.txt"], new TextEncoder().encode("b"), "text/plain");
    await base.writeFile(["folder","c.txt"], new TextEncoder().encode("c"), "text/plain");
    await setOrder(base, "/folder", ["c.txt","a.txt","b.txt"]);
    const dl = createDataLoaderAdapter(base);
    const out = await applyOrder(dl, "/folder", ["a.txt","b.txt","c.txt"]);
    expect(out).toEqual(["c.txt","a.txt","b.txt"]);
  });

  it("applyOrder via DataLoaderAdapter sees Z:order props written via base", async () => {
    const base = createMemoryAdapter();
    await base.ensureDir(["folder"]);
    await base.writeFile(["folder","a.txt"], new TextEncoder().encode("a"), "text/plain");
    await base.writeFile(["folder","b.txt"], new TextEncoder().encode("b"), "text/plain");
    await base.writeFile(["folder","c.txt"], new TextEncoder().encode("c"), "text/plain");
    // Write props
    const { createDavStateStore } = await import("../dav-state");
    const store = createDavStateStore(base);
    await store.mergeProps("/folder", { "Z:order": "c.txt,a.txt,b.txt" });
    const dl = createDataLoaderAdapter(base);
    const out = await applyOrder(dl, "/folder", ["a.txt","b.txt","c.txt"]);
    expect(out).toEqual(["c.txt","a.txt","b.txt"]);
  });
});
