/**
 * @file Unit tests for MKCOL handler (co-located)
 */
import { handleMkcolRequest, createMkcolOnGenerate } from "../handlers";
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

describe("MKCOL handler", () => {
  it("creates directory", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const res = await handleMkcolRequest("/new-folder", { persist, logger });
    expect(res.response.status).toBe(201);
    expect(await persist.exists(["new-folder"])).toBe(true);
  });

  it("calls on-generate callback", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const state = { called: 0 as number };
    const onGenerate = (path: string[]) => { state.called = state.called + (path.length > 0 ? 1 : 0); };
    await handleMkcolRequest("/with-callback", { persist, logger, onGenerate });
    expect(state.called).toBe(1);
  });

  it("returns 409 when parent missing", async () => {
    const persist = createMemoryAdapter();
    const logger = createLogger();
    const res = await handleMkcolRequest("/parent/child", { persist, logger });
    expect(res.response.status).toBe(409);
  });
});

describe("createMkcolOnGenerate", () => {
  it("returns undefined without LLM", () => {
    const cb = createMkcolOnGenerate(undefined);
    expect(cb).toBeUndefined();
  });

  it("creates callback that uses LLM and swallows errors", async () => {
    const persist = createMemoryAdapter();
    const llm: LlmLike = {
      async fabricateListing(path: string[]) { await persist.ensureDir(path); },
      async fabricateFileContent() { return ""; },
    };
    const cb = createMkcolOnGenerate(llm)!;
    await cb(["folder"]);
    expect(await persist.exists(["folder"])).toBe(true);

    const failing: LlmLike = {
      async fabricateListing() { throw new Error("fail"); },
      async fabricateFileContent() { return ""; },
    };
    const cb2 = createMkcolOnGenerate(failing)!;
    await cb2(["x"]); // should not throw
  });
});

