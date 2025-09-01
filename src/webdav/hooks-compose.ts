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
    async beforeGet(ctx) { return await first((h) => h.beforeGet, ctx); },
    async beforePut(ctx) { return await first((h) => h.beforePut, ctx); },
    async beforePropfind(ctx) { return await first((h) => h.beforePropfind, ctx); },
  };
}
