/**
 * @file Utilities to compose WebDAV hooks with short-circuit semantics.
 */
import type { WebDavHooks, MaybePromise } from "./hooks";

/**
 * Compose multiple hooks objects; for authorize, returns the first non-undefined
 * response (short-circuits). Other hooks are invoked in order until one
 * returns a response; if all undefined, returns undefined.
 */
export function composeHooks(...hooksList: Array<WebDavHooks | undefined>): WebDavHooks {
  const list = hooksList.filter((h): h is WebDavHooks => Boolean(h));
  type Func<TArgs extends unknown[], TRes> = ((...a: TArgs) => MaybePromise<TRes | undefined>) | undefined;
  async function first<TArgs extends unknown[], TRes>(get: (h: WebDavHooks) => Func<TArgs, TRes>, ...args: TArgs): Promise<TRes | undefined> {
    for (const h of list) {
      const fn = get(h);
      if (!fn) { continue; }
      try {
        const out = await fn(...args);
        if (out !== undefined) { return out; }
      } catch {
        // ignore and continue
      }
    }
    return undefined;
  }
  return {
    async authorize(ctx) { return await first((h) => h.authorize, ctx); },
    async beforeRequest(ctx) { return await first((h) => h.beforeRequest, ctx); },
    async beforeGet(ctx) { return await first((h) => h.beforeGet, ctx); },
    async beforePut(ctx) { return await first((h) => h.beforePut, ctx); },
    async beforePropfind(ctx) { return await first((h) => h.beforePropfind, ctx); },
    async beforeReport(ctx) { return await first((h) => h.beforeReport, ctx); },
    async afterGet(ctx, res) {
      for (const h of list) {
        if (h.afterGet) {
          const out = await h.afterGet(ctx, res);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
    async afterPropfind(ctx, res) {
      for (const h of list) {
        if (h.afterPropfind) {
          const out = await h.afterPropfind(ctx, res);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
    async afterPut(ctx, res) {
      for (const h of list) {
        if (h.afterPut) {
          const out = await h.afterPut(ctx, res);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
    async afterMkcol(ctx, res) {
      for (const h of list) {
        if (h.afterMkcol) {
          const out = await h.afterMkcol(ctx, res);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
    async afterReport(ctx, res) {
      for (const h of list) {
        if (h.afterReport) {
          const out = await h.afterReport(ctx, res);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
    async afterRequest(ctx, res) {
      for (const h of list) {
        if (h.afterRequest) {
          const out = await h.afterRequest(ctx, res);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
    async afterOptions(ctx, headers) {
      for (const h of list) {
        if (h.afterOptions) {
          const out = await h.afterOptions(ctx, headers);
          if (out !== undefined) { return out; }
        }
      }
      return undefined;
    },
  };
}
