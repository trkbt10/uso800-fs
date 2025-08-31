/**
 * @file Unit tests for MKCOL handler (co-located)
 */
import { handleMkcolRequest } from "../../webdav/handlers";
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

describe("MKCOL handler", () => {
  it("creates directory", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const res = await handleMkcolRequest("/new-folder", { persist, logger });
    expect(res.response.status).toBe(201);
    expect(await persist.exists(["new-folder"])).toBe(true);
  });

  it("runs afterMkcol hook", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const calls: number[] = [];
    const hooks: WebDavHooks = {
      async afterMkcol() { calls.push(1); }
    };
    await handleMkcolRequest("/with-callback", { persist, logger, hooks });
    expect(calls.length).toBe(1);
  });

  it("returns 409 when parent missing", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const res = await handleMkcolRequest("/parent/child", { persist, logger });
    expect(res.response.status).toBe(409);
  });
});

describe("createLlmWebDavHooks", () => {
  it("afterMkcol uses LLM fabricateListing and swallows errors", async () => {
    const persist = createMemoryAdapter();
    const llmOk: LlmOrchestrator = {
      async fabricateListing(path) { await persist.ensureDir(path); },
      async fabricateFileContent() { return ""; },
    };
    const hooksOk = createLlmWebDavHooks(llmOk);
    await hooksOk.afterMkcol?.({ urlPath: "/folder", segments: ["folder"], persist, logger: createLogger() }, { status: 201 });
    expect(await persist.exists(["folder"])).toBe(true);

    const llmFail: LlmOrchestrator = {
      async fabricateListing() { throw new Error("fail"); },
      async fabricateFileContent() { return ""; },
    };
    const hooksFail = createLlmWebDavHooks(llmFail);
    await hooksFail.afterMkcol?.({ urlPath: "/x", segments: ["x"], persist, logger: createLogger() }, { status: 201 });
    // should not throw
  });
});
