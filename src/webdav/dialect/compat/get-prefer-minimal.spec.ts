/** @file GET Prefer:return=minimal compat tests */
import { makeWebdavApp } from "../../server";
import { createMemoryAdapter } from "../../persist/memory";

describe("GET Prefer:return=minimal compat", () => {
  it("returns 204 and Preference-Applied", async () => {
    const app = makeWebdavApp({ persist: createMemoryAdapter() });
    await app.request(new Request("http://localhost/a.txt", { method: "PUT", body: new TextEncoder().encode("x") }));
    const r = await app.request(new Request("http://localhost/a.txt", { method: "GET", headers: { Prefer: "return=minimal" } }));
    expect(r.status).toBe(204);
    expect(r.headers.get("Preference-Applied")).toBe("return=minimal");
  });
});

