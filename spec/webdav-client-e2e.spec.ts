/**
 * @file WebDAV client E2E against in-process Hono server.
 * Uses a stub LLM and memory persist to verify behavior over HTTP.
 */
import { makeWebdavApp } from "../src/webdav/server";
import { createMemoryAdapter } from "../src/webdav/persist/memory";
import type { PersistAdapter } from "../src/webdav/persist/types";
import { createServer } from "node:http";
import { createClient } from "webdav";
import { createLlmWebDavHooks, type LlmOrchestrator } from "../src/llm/webdav-hooks";

async function withHttp(app: { fetch: (req: Request) => Promise<Response> | Response }, fn: (baseURL: string) => Promise<void>) {
  const srv = createServer(async (req, res) => {
    const url = `http://${req.headers.host}${req.url ?? "/"}`;
    const hdrs = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) { hdrs.set(k, v.join(", ")); }
      else if (typeof v === "string") { hdrs.set(k, v); }
    }
    const method = req.method ?? "GET";
    const body = await (async () => {
      if (method === "GET" || method === "HEAD") { return undefined; }
      const chunks: Buffer[] = [];
      return await new Promise<Uint8Array | undefined>((resolve) => {
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", () => resolve(undefined));
      });
    })();
    // Normalize Uint8Array to ArrayBuffer for Request body to satisfy DOM BodyInit
    const normalizedBody = (() => {
      if (!body) { return undefined; }
      const copy = new Uint8Array(body.byteLength);
      copy.set(body);
      return new Blob([copy.buffer]);
    })();
    const request = new Request(url, { method, headers: hdrs, body: normalizedBody as Blob | undefined });
    try {
      const r = await Promise.resolve(app.fetch(request));
      res.statusCode = r.status;
      r.headers.forEach((v, k) => res.setHeader(k, v));
      if (method === "HEAD") { res.end(); return; }
      const ab = await r.arrayBuffer().catch(() => undefined);
      if (ab) { res.end(Buffer.from(ab)); } else { res.end(); }
    } catch {
      res.statusCode = 500; res.end();
    }
  });
  await new Promise<void>((ok) => srv.listen(0, ok));
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const baseURL = `http://127.0.0.1:${port}`;
  try { await fn(baseURL); } finally { await new Promise<void>((ok) => srv.close(() => ok())); }
}

describe("WebDAV client E2E", () => {
  const canListen = Boolean(process.env.ALLOW_HTTP_TESTS);
  const maybeIt = canListen ? it : it.skip;
  maybeIt("PROPFIND fabricates on missing/empty and persists; GET fabricates on missing/empty file", async () => {
    function hasBasename(x: unknown): x is { basename: string } {
      if (typeof x !== "object" || x === null) { return false; }
      if (!("basename" in x)) { return false; }
      const b = (x as { basename: unknown }).basename;
      return typeof b === "string";
    }
    const persist: PersistAdapter = createMemoryAdapter();
    const calls = { list: 0, file: 0 };
    const llm: LlmOrchestrator = {
      async fabricateListing(path) {
        calls.list += 1;
        await persist.ensureDir(path);
        await persist.writeFile([...path, "gen.txt"], new TextEncoder().encode("gen"), "text/plain");
      },
      async fabricateFileContent(path) {
        calls.file += 1;
        const name = path[path.length - 1] ?? "file.txt";
        return `auto:${name}`;
      },
    };
    const app = makeWebdavApp({ persist, hooks: createLlmWebDavHooks(llm) });
    await withHttp(app, async (base) => {
      const client = createClient(base);

      // PROPFIND on non-existent folder triggers fabricateListing
      const contents1 = await client.getDirectoryContents("/newdir/");
      expect(Array.isArray(contents1)).toBe(true);
      function containsGenTxt(list: unknown): boolean {
        if (!Array.isArray(list)) { return false; }
        for (const i of list) {
          if (!hasBasename(i)) { continue; }
          if (i.basename === "gen.txt") { return true; }
        }
        return false;
      }
      const found1 = containsGenTxt(contents1);
      expect(found1).toBe(true);
      expect(calls.list).toBe(1);

      // GET on non-existent file triggers fabricateFileContent
      const text1 = await client.getFileContents("/hello.txt", { format: "text" });
      expect(text1).toBe("auto:hello.txt");
      expect(calls.file).toBe(1);

      // PUT empty body triggers fabricateFileContent
      await client.putFileContents("/empty.txt", Buffer.from([]));
      const text2 = await client.getFileContents("/empty.txt", { format: "text" });
      expect(text2).toBe("auto:empty.txt");
      expect(calls.file).toBe(2);

      // Existing empty dir triggers fabricateListing once
      await client.createDirectory("/blank");
      const contents2 = await client.getDirectoryContents("/blank/");
      const found2 = containsGenTxt(contents2);
      expect(found2).toBe(true);
      expect(calls.list).toBe(2);

      // Subsequent GET/PROPFIND do not increase calls (persist serves)
      const contents3 = await client.getDirectoryContents("/blank/");
      if (Array.isArray(contents3)) {
        expect(contents3.length).toBeGreaterThan(0);
      } else {
        // webdav client may return ResponseDataDetailed<T>
        expect((contents3 as { data: unknown[] }).data.length).toBeGreaterThan(0);
      }
      const text3 = await client.getFileContents("/hello.txt", { format: "text" });
      expect(text3).toBe("auto:hello.txt");
      expect(calls).toEqual({ list: 2, file: 2 });
    });
  }, 10000);
});

/**
 * Notes (debugging approach):
 * - Added explicit cast for Request body because lib DOM BodyInit typing in this environment
 *   did not include Uint8Array, while runtime supports it. Verified by reading this file
 *   and the helper using Node's http server.
 * - Narrowed `getDirectoryContents` return type to handle union with ResponseDataDetailed,
 *   avoiding a direct `.length` that caused TS errors during `bun run typecheck`.
 */
