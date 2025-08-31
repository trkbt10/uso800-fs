#!/usr/bin/env bun
/**
 * @file Hono-based WebDAV app factory using PersistAdapter directly.
 */
import { Hono, type Context } from "hono";
import type { DavResponse } from "./handlers/types";
import { handleOptions } from "./handlers/options";
import type { PersistAdapter } from "./persist/types";
import { createWebDAVLogger, type WebDAVLogger } from "../logging/webdav-logger";
import { buildIgnoreRegexps, isIgnoredFactory } from "./ignore";
import {
  handleHttpGetRequest,
  handlePutRequest,
  handlePropfindRequest,
  handleMkcolRequest,
  handleHeadRequest,
  handleDeleteRequest,
  handleMoveRequest,
  handleCopyRequest,
  handleLockRequest,
  handleUnlockRequest,
  handleProppatchRequest,
} from "./";
import type { WebDavHooks } from "./hooks";
import { createDavStateStore } from "./dav-state";

/**
 * Creates a Hono-based WebDAV app using the provided PersistAdapter.
 * Superficially, it looks like a thin router; in reality, it also enforces
 * method-specific invariants (e.g., MKCOL body rejection, LOCK token checks),
 * injects default WebDAV headers, and integrates directory/file ignore filters.
 */
export function makeWebdavApp(opts: {
  persist: PersistAdapter;
  hooks?: WebDavHooks;
  logger?: WebDAVLogger;
  ignoreGlobs?: string[];
}) {
  const basePersist = opts.persist;
  const hooks = opts.hooks;
  const logger = opts.logger ?? createWebDAVLogger();
  const app = new Hono();

  const ignoreRes = buildIgnoreRegexps([...(opts.ignoreGlobs ?? []), "**/_dav/**"]);
  const isIgnored = isIgnoredFactory(ignoreRes);
  const davState = createDavStateStore(basePersist);

  function send(c: Context, res: DavResponse) {
    const status = res.status;
    const init: ResponseInit = { status, headers: res.headers };
    const noBody = status === 204 || status === 304;
    const body = noBody ? undefined : (res.body as BodyInit | undefined);
    return new Response(body, init);
  }

  app.all("*", async (c, next) => {
    c.header("DAV", "1,2");
    c.header("MS-Author-Via", "DAV");
    c.header("Allow", "OPTIONS, PROPFIND, MKCOL, GET, HEAD, PUT, DELETE, MOVE, COPY");
    await next();
  });

  app.options("/*", (c) => {
    logger.logInput("OPTIONS", c.req.path);
    return send(c, handleOptions(logger));
  });

  function maybeIgnore(c: Context, method: string): Response | null {
    const p = c.req.path;
    logger.logInput(method, p);
    if (isIgnored(p)) {
      logger.logOutput(method, p, 404);
      return send(c, { status: 404 });
    }
    return null;
  }

  app.get("/*", async (c) => {
    const ignored = maybeIgnore(c, "GET");
    if (ignored) {
      return ignored;
    }
    const p = c.req.path;
    const persist = basePersist;
    const hdrs: Record<string, string> = {};
    for (const [k, v] of c.req.raw.headers) {
      hdrs[k] = v;
    }
    const result = await handleHttpGetRequest(p, hdrs, { persist, hooks, logger });
    return send(c, result.response);
  });

  app.on("HEAD", "/*", async (c) => {
    const ignored = maybeIgnore(c, "HEAD");
    if (ignored) {
      return ignored;
    }
    const p = c.req.path;
    const persist = basePersist;
    const result = await handleHeadRequest(p, { persist, logger });
    return send(c, result.response);
  });

  app.on("PUT", "/*", async (c) => {
    const p = c.req.path;
    const persist = basePersist;
    const body = await c.req.arrayBuffer();
    const curLock = await davState.getLock(p);
    if (curLock) {
      const provided = c.req.header("Lock-Token");
      if (!provided || provided !== curLock.token) {
        return send(c, { status: 423 });
      }
    }
    const result = await handlePutRequest(p, body, { persist, hooks, logger });
    return send(c, result.response);
  });

  app.on("DELETE", "/*", async (c) => {
    logger.logInput("DELETE", c.req.path);
    const p = c.req.path;
    const persist = basePersist;
    const curLock = await davState.getLock(p);
    if (curLock) {
      const provided = c.req.header("Lock-Token");
      if (!provided || provided !== curLock.token) {
        return send(c, { status: 423 });
      }
    }
    const result = await handleDeleteRequest(p, { persist, logger });
    return send(c, result.response);
  });

  app.use("/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const p = c.req.path;

    if (method === "PROPFIND") {
      const depth = c.req.header("Depth") ?? null;
      if (isIgnored(p)) {
        logger.logOutput("PROPFIND", p, 404);
        return send(c, { status: 404 });
      }
      const persist = basePersist;
      const result = await handlePropfindRequest(p, depth, {
        persist,
        hooks,
        logger,
        shouldIgnore: (full: string, base: string) => {
          if (isIgnored(full)) {
            return true;
          }
          if (isIgnored(base)) {
            return true;
          }
          return false;
        },
      });
      return send(c, result.response);
    }

    if (method === "MKCOL") {
      try {
        const bodyText = await c.req.text();
        if (bodyText && bodyText.length > 0) {
          return send(c, { status: 415 });
        }
      } catch (_e) {
        // Ignore body read errors intentionally; MKCOL with body is unsupported.
      }
      const persist = basePersist;
      const result = await handleMkcolRequest(p, { persist, hooks, logger });
      return send(c, result.response);
    }

    if (method === "LOCK") {
      const result = await handleLockRequest(p, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "UNLOCK") {
      const sent = c.req.header("Lock-Token") ?? "";
      const token = sent ? sent : undefined;
      const result = await handleUnlockRequest(p, token, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "PROPPATCH") {
      const body = await c.req.text();
      const result = await handleProppatchRequest(p, body, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "MOVE") {
      const destination = c.req.header("Destination");
      if (!destination) {
        return send(c, { status: 400 });
      }
      const overwrite = (c.req.header("Overwrite") ?? "T").toUpperCase() !== "F";
      const persist = basePersist;
      const destUrl = new URL(destination);
      const result = await handleMoveRequest(p, destUrl.pathname, { persist, logger, overwrite });
      return send(c, result.response);
    }

    if (method === "COPY") {
      const destination = c.req.header("Destination");
      if (!destination) {
        return send(c, { status: 400 });
      }
      const overwrite = (c.req.header("Overwrite") ?? "T").toUpperCase() !== "F";
      const persist = basePersist;
      const destUrl = new URL(destination);
      const result = await handleCopyRequest(p, destUrl.pathname, { persist, logger, overwrite });
      return send(c, result.response);
    }

    await next();
  });

  return app;
}
