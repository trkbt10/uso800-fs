/**
 * @file Auth hooks integration tests (Basic/Bearer)
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";
import { createBasicAuthHooks, createBearerAuthHooks } from "./auth/basic";

describe("WebDAV auth hooks", () => {
  it("Basic auth: 401 when missing, 200 after credentials", async () => {
    const persist = createMemoryAdapter();
    const hooks = createBasicAuthHooks("user", "pass");
    const app = makeWebdavApp({ persist, hooks });

    // Missing -> 401 + WWW-Authenticate
    const res1 = await app.request("/", { method: "PROPFIND", headers: { Depth: "0" } });
    expect(res1.status).toBe(401);
    expect(res1.headers.get("WWW-Authenticate") ?? "").toContain("Basic");

    // With creds -> 207
    const creds = Buffer.from("user:pass").toString("base64");
    const res2 = await app.request("/", { method: "PROPFIND", headers: { Depth: "0", Authorization: `Basic ${creds}` } });
    expect(res2.status).toBe(207);
  });

  it("Bearer auth: 401 missing, 403 mismatch, 201 on PUT with valid token", async () => {
    const persist = createMemoryAdapter();
    const hooks = createBearerAuthHooks("secret");
    const app = makeWebdavApp({ persist, hooks });

    const miss = await app.request("/file.txt", { method: "PUT", body: "x" });
    expect(miss.status).toBe(401);

    const wrong = await app.request("/file.txt", { method: "PUT", body: "x", headers: { Authorization: "Bearer nope" } });
    expect(wrong.status).toBe(403);

    const ok = await app.request("/file.txt", { method: "PUT", body: "x", headers: { Authorization: "Bearer secret" } });
    expect(ok.status).toBe(201);
  });
});
