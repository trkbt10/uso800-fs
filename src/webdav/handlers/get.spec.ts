/**
 * @file Unit tests for GET handler (co-located)
 */
import { handleGetRequest } from "./get";
import { handleHeadRequest } from "./head";
import { createMemoryAdapter } from "../persist/memory";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { WebDavHooks } from "../hooks";

function createLogger(): WebDAVLogger {
  const noop = () => {};
  return {
    logInput: noop,
    logOutput: noop,
    logOperation: noop,
    logRead: noop,
    logWrite: noop,
    logList: noop,
    logCreate: noop,
    logDelete: noop,
    logMove: noop,
    logCopy: noop,
  };
}

function createHooks(persist: ReturnType<typeof createMemoryAdapter>): WebDavHooks {
  return {
    async beforeGet({ urlPath, segments }) {
      const isDir = (() => {
        if (segments.length === 0) { return false; }
        return urlPath.endsWith("/");
      })();
      if (!isDir) {
        // create file content when missing
        await persist.writeFile(segments, new TextEncoder().encode("Generated content"), "text/plain").catch(() => {});
      } else {
        await persist.ensureDir(segments).catch(() => {});
      }
    },
  };
}

describe("GET handler", () => {
  it("returns 404 for non-existent file without hooks", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const result = await handleGetRequest("/missing.txt", { persist, logger });
    expect(result.response.status).toBe(404);
  });

  it("generates content for non-existent file with hooks", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const hooks = createHooks(persist);
    const result = await handleGetRequest("/gen.txt", { persist, logger, hooks });
    expect(result.response.status).toBe(200);
    const stored = await persist.readFile(["gen.txt"]);
    expect(new TextDecoder().decode(stored)).toBe("Generated content");
  });

  it("returns existing file content", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.writeFile(["existing.txt"], new TextEncoder().encode("Existing content"), "text/plain");
    const result = await handleGetRequest("/existing.txt", { persist, logger });
    expect(result.response.status).toBe(200);
    const body = result.response.body as Uint8Array;
    expect(new TextDecoder().decode(body)).toBe("Existing content");
    expect(result.response.headers?.["Content-Type"]).toBe("text/plain");
    expect(result.response.headers?.["ETag"]).toBeDefined();
  });

  it("returns matching ETag for GET after HEAD and changes on rewrite", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const path = ["etag.txt"] as const;
    await persist.writeFile([...path], new TextEncoder().encode("v1"), "text/plain");
    const head1 = await handleHeadRequest("/etag.txt", { persist });
    const get1 = await handleGetRequest("/etag.txt", { persist, logger });
    expect(head1.response.headers?.["ETag"]).toBe(get1.response.headers?.["ETag"]);
    // rewrite
    await new Promise((r) => setTimeout(r, 5));
    await persist.writeFile([...path], new TextEncoder().encode("v2"), "text/plain");
    const head2 = await handleHeadRequest("/etag.txt", { persist });
    expect(head2.response.headers?.["ETag"]).not.toBe(head1.response.headers?.["ETag"]);
  });

  it("generates content for empty file with hooks", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const hooks = createHooks(persist);
    await persist.writeFile(["empty.txt"], new Uint8Array(0), "text/plain");
    const result = await handleGetRequest("/empty.txt", { persist, logger, hooks });
    expect(result.response.status).toBe(200);
    const body = result.response.body as Uint8Array;
    expect(new TextDecoder().decode(body)).toBe("Generated content");
  });

  it("handles root path correctly", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const result = await handleGetRequest("/", { persist, logger });
    expect(result.response.status).toBe(200);
    expect(result.response.headers?.["Content-Type"]).toBe("text/html");
  });
});
