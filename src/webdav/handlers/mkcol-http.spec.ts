/**
 * @file Unit tests for MKCOL HTTP wrapper
 */
import { handleMkcolHttpRequest } from "./mkcol-http";
import { createMemoryAdapter } from "../persist/memory";

describe("MKCOL HTTP wrapper", () => {
  it("returns 415 when body exists", async () => {
    const persist = createMemoryAdapter();
    const r = await handleMkcolHttpRequest("/x", true, { persist });
    expect(r.response.status).toBe(415);
  });

  it("delegates to mkcol when no body", async () => {
    const persist = createMemoryAdapter();
    const r = await handleMkcolHttpRequest("/x", false, { persist });
    expect([201, 409, 405]).toContain(r.response.status);
    const exists = await persist.exists(["x"]);
    expect(exists).toBe(true);
  });
});
