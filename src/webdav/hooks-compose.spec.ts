/**
 * @file Unit tests for hooks composition
 */
import type { WebDavHooks } from "./hooks";
import { composeHooks } from "./hooks-compose";

function makeHooks(tag: string, reply?: number): WebDavHooks {
  return {
    async authorize() { return reply ? { status: reply } : undefined; },
    async beforeGet() { return undefined; },
    async beforePut() { return undefined; },
    async beforePropfind() { return undefined; },
  };
}

describe("composeHooks", () => {
  it("returns first authorize response", async () => {
    const h1 = makeHooks("a", undefined);
    const h2 = makeHooks("b", 401);
    const h3 = makeHooks("c", 403);
    const h = composeHooks(h1, h2, h3);
    const res = await h.authorize?.({
      urlPath: "/",
      method: "GET",
      headers: {},
      authorizationRaw: undefined,
      authorization: undefined,
      segments: [],
      persist: {
        ensureDir: async () => {},
        readdir: async () => [],
        stat: async () => ({ type: "file" as const }),
        exists: async () => false,
        readFile: async () => new Uint8Array(),
        writeFile: async () => {},
        remove: async () => {},
        move: async () => {},
        copy: async () => {},
      },
      logger: undefined,
    });
    expect(res?.status).toBe(401);
  });
});
