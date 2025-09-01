/**
 * @file Unit tests for response helpers
 */
import { toResponse } from "./response";

describe("response helpers", () => {
  it("creates Response with body for 200", async () => {
    const r = toResponse({ status: 200, headers: { "Content-Type": "text/plain" }, body: "ok" });
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("text/plain");
    expect(await r.text()).toBe("ok");
  });
  it("creates Response without body for 204", async () => {
    const r = toResponse({ status: 204, headers: { "X": "y" } });
    expect(r.status).toBe(204);
    expect(r.headers.get("X")).toBe("y");
    expect(await r.text()).toBe("");
  });
});

