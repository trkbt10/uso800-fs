/**
 * @file Guarantees WebDAV operations for existing files (non-LLM paths).
 * Focus: when a real file exists, standard WebDAV verbs behave predictably.
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

describe("WebDAV: existing file operations", () => {
  it("GET/HEAD/PROPFIND behave for existing file", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });

    // Seed file via PUT (201 Created)
    const putRes = await app.request("/file.txt", { method: "PUT", body: "hello" });
    expect(putRes.status).toBe(201);

    // GET returns full content
    const getRes = await app.request("/file.txt", { method: "GET" });
    expect(getRes.status).toBe(200);
    const body = await getRes.text();
    expect(body).toBe("hello");

    // HEAD returns 200 with standard headers
    const headRes = await app.request("/file.txt", { method: "HEAD" });
    expect(headRes.status).toBe(200);
    expect(headRes.headers.get("Accept-Ranges")).toBe("bytes");
    expect(headRes.headers.get("Content-Length")).toBe("5");

    // PROPFIND at parent lists the file
    const pfRes = await app.request("/", { method: "PROPFIND", headers: { Depth: "1" } });
    expect(pfRes.status).toBe(207);
    const xml = await pfRes.text();
    expect(xml).toContain("file.txt");
  });

  it("Range GET on existing file returns 206 with slice", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request("/r.txt", { method: "PUT", body: "hello" });

    const res = await app.request("/r.txt", { method: "GET", headers: { Range: "bytes=1-3" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 1-3/5");
    const t = await res.text();
    expect(t).toBe("ell");
  });

  it("MOVE honors Overwrite and moves content", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request("/src.txt", { method: "PUT", body: "aaa" });
    await app.request("/dst.txt", { method: "PUT", body: "bbb" });

    // Overwrite=F fails when destination exists
    const moveF = await app.request("/src.txt", { method: "MOVE", headers: { Destination: "http://localhost/dst.txt", Overwrite: "F" } });
    expect(moveF.status).toBe(412);

    // Overwrite=T succeeds
    const moveT = await app.request("/src.txt", { method: "MOVE", headers: { Destination: "http://localhost/dst.txt", Overwrite: "T" } });
    expect([204, 201]).toContain(moveT.status);

    const txt = await (await app.request("/dst.txt", { method: "GET" })).text();
    expect(txt).toBe("aaa");
    const getSrc = await app.request("/src.txt", { method: "GET" });
    expect(getSrc.status).toBe(404);
  });

  it("COPY honors Overwrite and copies content", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request("/a.txt", { method: "PUT", body: "X" });
    await app.request("/b.txt", { method: "PUT", body: "Y" });

    // Overwrite=F fails if destination exists
    const copyF = await app.request("/a.txt", { method: "COPY", headers: { Destination: "http://localhost/b.txt", Overwrite: "F" } });
    expect(copyF.status).toBe(412);

    // Overwrite=T replaces content
    const copyT = await app.request("/a.txt", { method: "COPY", headers: { Destination: "http://localhost/b.txt", Overwrite: "T" } });
    expect([204, 201]).toContain(copyT.status);
    const txt = await (await app.request("/b.txt", { method: "GET" })).text();
    expect(txt).toBe("X");
  });

  it("DELETE removes an existing file and subsequent GET is 404", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request("/z.txt", { method: "PUT", body: "z" });

    const del = await app.request("/z.txt", { method: "DELETE" });
    expect(del.status).toBe(204);
    const getAfter = await app.request("/z.txt", { method: "GET" });
    expect(getAfter.status).toBe(404);
  });
});

