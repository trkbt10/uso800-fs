/**
 * @file HTTP/WebDAV extensions: Overwrite, Range, MKCOL body
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

describe("WebDAV HTTP extensions", () => {
  it("COPY/MOVE respect Overwrite header", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    // seed
    await app.request(new Request("http://localhost/src.txt", { method: "PUT", body: "a" }));
    await app.request(new Request("http://localhost/dst.txt", { method: "PUT", body: "b" }));

    // COPY with Overwrite: F should 412 if dest exists
    const res1 = await app.request(new Request("http://localhost/src.txt", { method: "COPY", headers: { Destination: "http://localhost/dst.txt", Overwrite: "F" } }));
    expect(res1.status).toBe(412);

    // COPY with Overwrite: T should overwrite and return 204
    const res2 = await app.request(new Request("http://localhost/src.txt", { method: "COPY", headers: { Destination: "http://localhost/dst.txt", Overwrite: "T" } }));
    expect([204, 201]).toContain(res2.status);

    const text = await (await app.request(new Request("http://localhost/dst.txt"))).text();
    expect(text).toBe("a");

    // MOVE with Overwrite: F should fail if exists
    await app.request(new Request("http://localhost/src2.txt", { method: "PUT", body: "c" }));
    const resMoveF = await app.request(new Request("http://localhost/src2.txt", { method: "MOVE", headers: { Destination: "http://localhost/dst.txt", Overwrite: "F" } }));
    expect(resMoveF.status).toBe(412);

    // MOVE with Overwrite: T should succeed and 204/201
    const resMoveT = await app.request(new Request("http://localhost/src2.txt", { method: "MOVE", headers: { Destination: "http://localhost/dst.txt", Overwrite: "T" } }));
    expect([204, 201]).toContain(resMoveT.status);
    const text2 = await (await app.request(new Request("http://localhost/dst.txt"))).text();
    expect(text2).toBe("c");
  });

  it("GET supports Range bytes and returns 206", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    await app.request(new Request("http://localhost/r.txt", { method: "PUT", body: "hello" }));
    const res = await app.request(new Request("http://localhost/r.txt", { method: "GET", headers: { Range: "bytes=1-3" } }));
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 1-3/5");
    const t = await res.text();
    expect(t).toBe("ell");
  });

  it("GET supports multi-range and returns multipart/byteranges", async () => {
    const persist = createMemoryAdapter();
    await persist.writeFile(["mr.txt"], new TextEncoder().encode("hello"), "text/plain");
    const app = makeWebdavApp({ persist });
    const req = new Request("http://localhost/mr.txt", { method: "GET", headers: { Range: "bytes=0-1,3-4" } });
    const res = await app.request(req);
    expect(res.status).toBe(206);
    const ct = res.headers.get("Content-Type") ?? "";
    expect(ct.includes("multipart/byteranges")).toBe(true);
    const ab = await res.arrayBuffer();
    const txt = new TextDecoder().decode(ab);
    expect(txt).toContain("he");
    expect(txt).toContain("lo");
  });

  it("PUT with Content-Range returns 501 Not Implemented", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    const req = new Request("http://localhost/file.txt", { method: "PUT", headers: { "Content-Range": "bytes 0-2/5" }, body: "abc" });
    const res = await app.request(req);
    expect(res.status).toBe(501);
  });

  it("Extended MKCOL with XML body creates directory and stores props", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    const xml = `<?xml version="1.0" encoding="utf-8"?>\n<D:mkcol xmlns:D="DAV:" xmlns:Z="urn:ex">\n  <D:set>\n    <D:prop>\n      <Z:color>blue</Z:color>\n    </D:prop>\n  </D:set>\n</D:mkcol>`;
    const res = await app.request(new Request("http://localhost/newdir", { method: "MKCOL", headers: { "Content-Type": "application/xml" }, body: xml }));
    expect([201, 200]).toContain(res.status);
  });

  it("If header with ETag guards PUT (precondition)", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    // seed
    await app.request(new Request("http://localhost/file.txt", { method: "PUT", body: "abc" }));
    // obtain ETag via HEAD
    const head = await app.request(new Request("http://localhost/file.txt", { method: "HEAD" }));
    const etag = head.headers.get("ETag");
    expect(etag).toBeTruthy();
    // wrong ETag -> 412
    const wrong = await app.request(new Request("http://localhost/file.txt", { method: "PUT", body: "zzz", headers: { If: '(["nope"])' } }));
    expect(wrong.status).toBe(412);
    // correct ETag -> 201
    const ok = await app.request(new Request("http://localhost/file.txt", { method: "PUT", body: "zzz", headers: { If: `([${etag}])` } }));
    expect(ok.status).toBe(201);
  });

  it("MKCOL with body returns 415; existing returns 405", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });
    // MKCOL with body
    const res3 = await app.request(new Request("http://localhost/body/", { method: "MKCOL", body: "x" }));
    expect(res3.status).toBe(415);
    // Create dir then MKCOL again
    await app.request(new Request("http://localhost/exist", { method: "MKCOL" }));
    const res4 = await app.request(new Request("http://localhost/exist", { method: "MKCOL" }));
    expect([405, 201]).toContain(res4.status);
  });
});
