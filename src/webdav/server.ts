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
import { pathToSegments } from "../utils/path-utils";
import { parseAuthorizationHeader } from "./auth/types";
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
import { checkDepthInfinityRequiredForDir, etagMatchesIfHeader, requireLockOk } from "./http-guards";
import { maybeIgnored } from "./ignore-guards";
import { toResponse } from "./response";
import { parseMkcolProps } from "./xml/mkcol-parse";

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

  // guard helpers are imported; use converter for responses
  function send(_c: Context, res: DavResponse) { return toResponse(res); }

  app.all("*", async (c, next) => {
    c.header("DAV", "1,2");
    c.header("MS-Author-Via", "DAV");
    c.header("Allow", "OPTIONS, PROPFIND, MKCOL, GET, HEAD, PUT, DELETE, MOVE, COPY");
    // Authorization hook (if provided)
    if (hooks && typeof hooks.authorize === "function") {
      const headersMap: Record<string, string> = {};
      for (const [k, v] of c.req.raw.headers) {
        headersMap[k] = v;
      }
      const authorizationRaw = c.req.header("Authorization");
      const parsed = parseAuthorizationHeader(authorizationRaw ?? undefined);
      const authRes = await Promise.resolve(
        hooks.authorize({
          urlPath: c.req.path,
          method: c.req.method.toUpperCase(),
          headers: headersMap,
          authorizationRaw,
          authorization: parsed,
          segments: pathToSegments(c.req.path),
          persist: basePersist,
          logger,
        }),
      ).catch(() => undefined);
      if (authRes) {
        return send(c, authRes);
      }
    }
    await next();
  });

  app.options("/*", (c) => {
    logger.logInput("OPTIONS", c.req.path);
    return send(c, handleOptions(logger));
  });

  function maybeIgnore(c: Context, method: string): Response | null {
    const p = c.req.path;
    const res = maybeIgnored(method, p, isIgnored, logger);
    if (res) { return send(c, res); }
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
    const ignored = maybeIgnore(c, "PUT");
    if (ignored) {
      return ignored;
    }
    const persist = basePersist;
    // Partial writes via Content-Range not implemented (explicit 501)
    const contentRange = c.req.header("Content-Range");
    if (contentRange && contentRange.trim().length > 0) {
      return send(c, { status: 501, headers: { "Accept-Ranges": "bytes" } });
    }
    const body = await c.req.arrayBuffer();
    const ok = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
    if (!ok) { return send(c, { status: 423 }); }
    const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
    if (!etagOk) { return send(c, { status: 412 }); }
    const result = await handlePutRequest(p, body, { persist, hooks, logger });
    return send(c, result.response);
  });

  app.on("DELETE", "/*", async (c) => {
    logger.logInput("DELETE", c.req.path);
    const p = c.req.path;
    const persist = basePersist;
    const ok = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
    if (!ok) { return send(c, { status: 423 }); }
    const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
    if (!etagOk) { return send(c, { status: 412 }); }
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
      const bodyText: string | null = await c.req.text().then((t) => t).catch(() => null);
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
      }, bodyText);
      return send(c, result.response);
    }

    if (method === "MKCOL") {
      if (isIgnored(p)) {
        logger.logOutput("MKCOL", p, 404);
        return send(c, { status: 404 });
      }
      const persist = basePersist;
      const contentType = (c.req.header("Content-Type") ?? "").toLowerCase();
      const bodyText = await c.req.text().then((t) => t).catch(() => "");
      if (bodyText.length > 0) {
        if (!contentType.includes("xml")) {
          return send(c, { status: 415 });
        }
      }
      const props: Record<string, string> | null = parseMkcolProps(bodyText, contentType);
      const result = await handleMkcolRequest(p, { persist, hooks, logger });
      if (result.response.status === 201) {
        if (props && Object.keys(props).length > 0) {
          const store = createDavStateStore(persist);
          await store.setProps(p, props);
        }
      }
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
      const ok = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
      if (!ok) { return send(c, { status: 423 }); }
      const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
      if (!etagOk) { return send(c, { status: 412 }); }
      const result = await handleProppatchRequest(p, body, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "COPY" || method === "MOVE") {
      const destination = c.req.header("Destination");
      if (!destination) { return send(c, { status: 400 }); }
      const overwrite = (c.req.header("Overwrite") ?? "T").toUpperCase() !== "F";
      const persist = basePersist;
      const destUrl = new URL(destination);
      const okDepth = await checkDepthInfinityRequiredForDir(persist, p, () => c.req.header("Depth"));
      if (!okDepth) { return send(c, { status: 400 }); }
      const srcOk = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
      const dstOk = await requireLockOk(davState, destUrl.pathname, c.req.raw.headers, "Lock-Token");
      if (!srcOk || !dstOk) { return send(c, { status: 423 }); }
      const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
      if (!etagOk) { return send(c, { status: 412 }); }
      if (method === "MOVE") {
        const moved = await handleMoveRequest(p, destUrl.pathname, { persist, logger, overwrite });
        return send(c, moved.response);
      }
      const copied = await handleCopyRequest(p, destUrl.pathname, { persist, logger, overwrite });
      return send(c, copied.response);
    }

    await next();
  });

  return app;
}
