/**
 * @file Unit tests for ignore guards
 */
import { maybeIgnored } from "./ignore-guards";
import type { WebDAVLogger } from "../logging/webdav-logger";

function createLogger(): { logger: WebDAVLogger; calls: Array<{ dir: "IN" | "OUT"; path: string; status?: number }> } {
  const calls: Array<{ dir: "IN" | "OUT"; path: string; status?: number }> = [];
  return {
    logger: {
      logInput: (_m: string, p: string) => calls.push({ dir: "IN", path: p }),
      logOutput: (_m: string, p: string, s: number) => calls.push({ dir: "OUT", path: p, status: s }),
      logOperation: () => {},
      logRead: () => {},
      logWrite: () => {},
      logList: () => {},
      logCreate: () => {},
      logDelete: () => {},
      logMove: () => {},
      logCopy: () => {},
    },
    calls,
  } as const;
}

describe("ignore-guards", () => {
  it("returns 404 for ignored paths and logs IN/OUT", () => {
    const { logger, calls } = createLogger();
    const isIgnored = (p: string) => p.includes("/_ignore");
    const res = maybeIgnored("GET", "/_ignore/file", isIgnored, logger);
    expect(res?.status).toBe(404);
    expect(calls.length).toBe(2);
    expect(calls[0]).toEqual({ dir: "IN", path: "/_ignore/file" });
    expect(calls[1]).toEqual({ dir: "OUT", path: "/_ignore/file", status: 404 });
  });
  it("returns null for allowed paths", () => {
    const { logger } = createLogger();
    const res = maybeIgnored("GET", "/ok", () => false, logger);
    expect(res).toBeNull();
  });
});
