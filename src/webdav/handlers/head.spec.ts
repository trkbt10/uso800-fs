/**
 * @file Unit tests for HEAD handler (co-located)
 */
import { handleHeadRequest } from "./head";
import { createMemoryAdapter } from "../persist/memory";

describe("HEAD handler", () => {
  it("returns 404 for non-existent path", async () => {
    const persist = createMemoryAdapter();
    const res = await handleHeadRequest("/missing.txt", { persist });
    expect(res.response.status).toBe(404);
  });

  it("returns directory headers for dir", async () => {
    const persist = createMemoryAdapter();
    await persist.ensureDir(["dir"]);
    const res = await handleHeadRequest("/dir", { persist });
    expect(res.response.status).toBe(200);
    expect(res.response.headers?.["Content-Type"]).toBe("text/html");
    expect(res.response.headers?.["Accept-Ranges"]).toBe("bytes");
    expect(res.response.body).toBeUndefined();
  });

  it("returns file headers for file", async () => {
    const persist = createMemoryAdapter();
    const data = new TextEncoder().encode("abc");
    await persist.writeFile(["file.txt"], data, "text/plain");
    const res = await handleHeadRequest("/file.txt", { persist });
    expect(res.response.status).toBe(200);
    expect(res.response.headers?.["Content-Type"]).toBe("text/plain");
    expect(res.response.headers?.["Content-Length"]).toBe(String(data.length));
    expect(res.response.headers?.["Accept-Ranges"]).toBe("bytes");
  });
});
