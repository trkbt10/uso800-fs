/**
 * @file Unit tests for PUT handler (co-located)
 */
import { handlePutRequest } from "../handlers";
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

function createLlm(): LlmLike {
  return {
    async fabricateListing() {},
    async fabricateFileContent() { return "Generated content"; },
  };
}

describe("PUT handler", () => {
  it("creates file with provided content", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const body = new TextEncoder().encode("Test content");
    const result = await handlePutRequest("/new.txt", body, { persist, logger });
    expect(result.response.status).toBe(201);
    const stored = await persist.readFile(["new.txt"]);
    expect(new TextDecoder().decode(stored)).toBe("Test content");
  });

  it("generates content for empty PUT with LLM", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const llm = createLlm();
    const result = await handlePutRequest("/empty.txt", new Uint8Array(0), { persist, logger, llm });
    expect(result.response.status).toBe(201);
    const stored = await persist.readFile(["empty.txt"]);
    expect(new TextDecoder().decode(stored)).toBe("Generated content");
  });

  it("creates empty file without LLM", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const result = await handlePutRequest("/empty.txt", new Uint8Array(0), { persist, logger });
    expect(result.response.status).toBe(201);
    const stored = await persist.readFile(["empty.txt"]);
    expect(stored.byteLength).toBe(0);
  });
});

