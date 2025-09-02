/**
 * @file Unit tests for PROPFIND handler (co-located)
 */
import { handlePropfindRequest } from "./propfind";
import { createMemoryAdapter } from "../persist/memory";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { WebDavHooks } from "../../webdav/hooks";
import { createLlmWebDavHooks, type LlmOrchestrator } from "../../llm/webdav-hooks";

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
  const llm: LlmOrchestrator = {
    async fabricateListing(path) {
      await persist.ensureDir(path);
      if (path.length > 0) {
        const dir = [...path];
        await persist.writeFile([...dir, "file.txt"], new TextEncoder().encode("content"), "text/plain");
      }
    },
    async fabricateFileContent() { /* notification only */ },
  };
  return createLlmWebDavHooks(llm);
}

describe("PROPFIND handler", () => {
  it("returns 404 for non-existent directory without hooks", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const result = await handlePropfindRequest("/missing", "1", { persist, logger });
    expect(result.response.status).toBe(404);
  });

  it("generates listing for non-existent directory with hooks", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const hooks = createHooks(persist);
    const result = await handlePropfindRequest("/new-dir", "1", { persist, logger, hooks });
    expect(result.response.status).toBe(207);
  });

  it("returns existing directory listing", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.ensureDir(["existing-dir"]);
    await persist.writeFile(["existing-dir", "file.txt"], new TextEncoder().encode("content"), "text/plain");
    const result = await handlePropfindRequest("/existing-dir", "1", { persist, logger });
    expect(result.response.status).toBe(207);
    expect(result.response.headers?.["Content-Type"]).toContain("application/xml");
  });

  it("generates listing for empty directory with hooks", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const hooks = createHooks(persist);
    await persist.ensureDir(["empty-dir"]);
    const result = await handlePropfindRequest("/empty-dir", "1", { persist, logger, hooks });
    expect([200, 207]).toContain(result.response.status);
  });

  it("handles root path correctly", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const result = await handlePropfindRequest("/", "1", { persist, logger });
    expect(result.response.status).toBe(207);
    const contents = await persist.readdir([]);
    expect(contents).not.toContain("root");
  });

  it("supports allprop and includes getlastmodified/getetag", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.writeFile(["afile.txt"], new TextEncoder().encode("x"), "text/plain");
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>`;
    const result = await handlePropfindRequest("/afile.txt", "0", { persist, logger }, body);
    const xml = String(result.response.body ?? "");
    expect(xml).toContain("<D:getlastmodified>");
    expect(xml).toContain("<D:getetag>");
  });

  it("supports propname and returns names only", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.writeFile(["b.txt"], new TextEncoder().encode("x"), "text/plain");
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:propname/></D:propfind>`;
    const result = await handlePropfindRequest("/b.txt", "0", { persist, logger }, body);
    const xml = String(result.response.body ?? "");
    expect(xml).toContain("<D:displayname/>");
    expect(xml).toContain("<D:getcontentlength/>");
  });

  it("supports prop selection for getcontentlength only", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.writeFile(["c.txt"], new TextEncoder().encode("xxx"), "text/plain");
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:getcontentlength/></D:prop></D:propfind>`;
    const result = await handlePropfindRequest("/c.txt", "0", { persist, logger }, body);
    const xml = String(result.response.body ?? "");
    expect(xml).toContain("<D:getcontentlength>3</D:getcontentlength>");
  });

  it("prop mode returns 404 propstat for unknown properties", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.writeFile(["d.txt"], new TextEncoder().encode("x"), "text/plain");
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:getcontentlength/><Z:unknown xmlns:Z="urn:x"/></D:prop></D:propfind>`;
    const result = await handlePropfindRequest("/d.txt", "0", { persist, logger }, body);
    const xml = String(result.response.body ?? "");
    expect(xml).toContain("<D:status>HTTP/1.1 404 Not Found</D:status>");
    expect(xml).toContain("<Z:unknown");
    expect(xml).toContain("<D:getcontentlength>");
  });

  it("prop mode returns quota-used-bytes for directory", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    await persist.ensureDir(["q"]);
    await persist.writeFile(["q", "a.txt"], new TextEncoder().encode("aa"), "text/plain");
    await persist.writeFile(["q", "b.txt"], new TextEncoder().encode("bbb"), "text/plain");
    const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:quota-used-bytes/></D:prop></D:propfind>`;
    const result = await handlePropfindRequest("/q/", "0", { persist, logger }, body);
    const xml = String(result.response.body ?? "");
    expect(xml).toContain("<D:quota-used-bytes>5</D:quota-used-bytes>");
  });
});
