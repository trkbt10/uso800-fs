/**
 * @file Unit tests for MKCOL handler (co-located)
 */
import { handleMkcolRequest } from "./mkcol";
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
    const hooks: WebDavHooks = { async afterMkcol() { calls.push(1); } };
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

describe("afterMkcol behavior", () => {
  it("afterMkcol can create directories and errors are swallowed", async () => {
    const persist = createMemoryAdapter();
    const hooksOk: WebDavHooks = { async afterMkcol({ segments }) { await persist.ensureDir(segments); } };
    await hooksOk.afterMkcol?.({ urlPath: "/folder", segments: ["folder"], persist, logger: createLogger() }, { status: 201 });
    expect(await persist.exists(["folder"])).toBe(true);

    const hooksFail: WebDavHooks = { async afterMkcol() { throw new Error("fail"); } };
    // Ensure the handler swallows afterMkcol errors
    await expect(handleMkcolRequest("/x", { persist, logger: createLogger(), hooks: hooksFail })).resolves.toBeTruthy();
  });
});
