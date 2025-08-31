/**
 * @file Unit tests for MOVE/COPY handlers
 */
import { handleMoveRequest, handleCopyRequest } from "./move-copy";
import { createMemoryAdapter } from "../persist/memory";

describe("MOVE/COPY handlers", () => {
  it("returns 404 when source missing", async () => {
    const persist = createMemoryAdapter();
    const m = await handleMoveRequest("/a.txt", "/b.txt", { persist });
    const c = await handleCopyRequest("/a.txt", "/b.txt", { persist });
    expect(m.response.status).toBe(404);
    expect(c.response.status).toBe(404);
  });

  it("respects overwrite flag for COPY", async () => {
    const persist = createMemoryAdapter();
    await persist.writeFile(["src.txt"], new TextEncoder().encode("s"), "text/plain");
    await persist.writeFile(["dst.txt"], new TextEncoder().encode("d"), "text/plain");
    const c1 = await handleCopyRequest("/src.txt", "/dst.txt", { persist, overwrite: false });
    expect(c1.response.status).toBe(412);
    const c2 = await handleCopyRequest("/src.txt", "/dst.txt", { persist, overwrite: true });
    expect([204, 201]).toContain(c2.response.status);
  });

  it("creates parents and moves when destination missing", async () => {
    const persist = createMemoryAdapter();
    await persist.writeFile(["a.txt"], new TextEncoder().encode("x"), "text/plain");
    const r = await handleMoveRequest("/a.txt", "/deep/path/b.txt", { persist });
    expect([201, 204]).toContain(r.response.status);
    expect(await persist.exists(["a.txt"])).toBe(false);
    expect(await persist.exists(["deep", "path", "b.txt"])).toBe(true);
  });
});
