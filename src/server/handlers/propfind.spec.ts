/**
 * @file Unit tests for PROPFIND handler (co-located)
 */
import { handlePropfindRequest } from "../handlers";
import { createMemoryAdapter } from "../../persist/memory";
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
    async fabricateFileContent() { return "Generated content"; },
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
});
