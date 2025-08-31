/**
 * @file Unit tests for PROPFIND handler (co-located)
 */
import { handlePropfindRequest } from "../handlers";
import { createMemoryAdapter } from "../../persist/memory";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { LlmLike } from "../handlers";

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

function createLlm(persist: ReturnType<typeof createMemoryAdapter>): LlmLike {
  return {
    async fabricateListing(path) {
      await persist.ensureDir(path);
      // create some demo content
      if (path.length > 0) {
        const dir = [...path];
        await persist.writeFile([...dir, "file.txt"], new TextEncoder().encode("content"), "text/plain");
      }
    },
    async fabricateFileContent() { return "Generated content"; },
  };
}

describe("PROPFIND handler", () => {
  it("returns 404 for non-existent directory without LLM", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const result = await handlePropfindRequest("/missing", "1", { persist, logger });
    expect(result.response.status).toBe(404);
  });

  it("generates listing for non-existent directory with LLM", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const llm = createLlm(persist);
    const result = await handlePropfindRequest("/new-dir", "1", { persist, logger, llm });
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

  it("generates listing for empty directory with LLM", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const llm = createLlm(persist);
    await persist.ensureDir(["empty-dir"]);
    const result = await handlePropfindRequest("/empty-dir", "1", { persist, logger, llm });
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

