#!/usr/bin/env bun
/**
 * @file Hono-based WebDAV app factory using PersistAdapter directly.
 */
import { Hono, type Context } from "hono";
import type { DavResponse } from "./handlers/types";
import { handleOptions } from "./handlers/options";
import type { PersistAdapter } from "./persist/types";
import { createWebDAVLogger, type WebDAVLogger } from "../logging/webdav-logger";
import { buildIgnoreRegexps, isIgnoredFactory, createIgnoreFilteringAdapter } from "./ignore";
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
import { isMethodAllowed } from "./acl";
import { handleSearchRequest } from "./handlers/search";
import { handleReportRequest } from "./handlers/report";
import { handleOrderpatchRequest } from "./handlers/orderpatch";
import type { DialectPolicy } from "./dialect/types";
import { strictDialect } from "./dialect/types";

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
  /** Optional client dialect policy layer (sidecar). */
  dialect?: DialectPolicy;
}) {
  const basePersist = opts.persist;
  const hooks = opts.hooks;
  const logger = opts.logger ?? createWebDAVLogger();
  const app = new Hono();

  const ignoreRes = buildIgnoreRegexps([...(opts.ignoreGlobs ?? []), "**/_dav/**"]);
  const isIgnored = isIgnoredFactory(ignoreRes);
  const filteredPersist = createIgnoreFilteringAdapter(basePersist, isIgnored);
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
    if (!(await isMethodAllowed(basePersist, c.req.path, "GET"))) {
      return send(c, { status: 403 });
    }
    const p = c.req.path;
    // Use ignore-filtering persist so GET directory listings hide internal entries like _dav
    const persist = filteredPersist;
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
    if (!(await isMethodAllowed(basePersist, c.req.path, "HEAD"))) {
      return send(c, { status: 403 });
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
    if (!(await isMethodAllowed(basePersist, p, "PUT"))) {
      return send(c, { status: 403 });
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
    if (!(await isMethodAllowed(basePersist, p, "DELETE"))) {
      return send(c, { status: 403 });
    }
    const ok = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
    if (!ok) { return send(c, { status: 423 }); }
    const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
    if (!etagOk) { return send(c, { status: 412 }); }
    const result = await handleDeleteRequest(p, { persist, logger });
    return send(c, result.response);
  });

  const compat: DialectPolicy = opts.dialect ?? strictDialect();

  app.use("/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const p = c.req.path;

    if (method === "PROPFIND") {
      if (!(await isMethodAllowed(basePersist, p, "PROPFIND"))) {
        return send(c, { status: 403 });
      }
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
      if (!(await isMethodAllowed(basePersist, p, "MKCOL"))) {
        return send(c, { status: 403 });
      }
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

    if (method === "SEARCH") {
      if (!(await isMethodAllowed(basePersist, p, "SEARCH"))) {
        return send(c, { status: 403 });
      }
      const body = await c.req.text().then((t) => t).catch(() => "");
      const res = await handleSearchRequest(p, { persist: basePersist, logger }, body);
      return send(c, res.response);
    }

    if (method === "LOCK") {
      if (!(await isMethodAllowed(basePersist, p, "LOCK"))) {
        return send(c, { status: 403 });
      }
      const result = await handleLockRequest(p, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "UNLOCK") {
      if (!(await isMethodAllowed(basePersist, p, "UNLOCK"))) {
        return send(c, { status: 403 });
      }
      const sent = c.req.header("Lock-Token") ?? "";
      const token = sent ? sent : undefined;
      const result = await handleUnlockRequest(p, token, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "PROPPATCH") {
      if (!(await isMethodAllowed(basePersist, p, "PROPPATCH"))) {
        return send(c, { status: 403 });
      }
      const body = await c.req.text();
      const ok = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
      if (!ok) { return send(c, { status: 423 }); }
      const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
      if (!etagOk) { return send(c, { status: 412 }); }
      const result = await handleProppatchRequest(p, body, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "COPY" || method === "MOVE") {
      if (!(await isMethodAllowed(basePersist, p, method))) {
        return send(c, { status: 403 });
      }
      const destination = c.req.header("Destination");
      if (!destination) { return send(c, { status: 400 }); }
      const overwrite = (c.req.header("Overwrite") ?? "T").toUpperCase() !== "F";
      const persist = basePersist;
      const destUrl = new URL(destination);
      const uaHeader = c.req.header("User-Agent");
      const ua = typeof uaHeader === "string" ? uaHeader : "";
      const relax = compat.shouldRelaxDepthForDirOps({
        method,
        path: p,
        userAgent: ua,
        getHeader(name: string): string {
          const v = c.req.header(name);
          return typeof v === "string" ? v : "";
        },
      });
      async function depthOk(): Promise<boolean> {
        if (relax) { return true; }
        return await checkDepthInfinityRequiredForDir(persist, p, () => c.req.header("Depth"));
      }
      const okDepth = await depthOk();
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

    if (method === "BIND") {
      if (!(await isMethodAllowed(basePersist, p, "BIND"))) {
        return send(c, { status: 403 });
      }
      const srcHeader = c.req.header("Source");
      if (!srcHeader) { return send(c, { status: 400 }); }
      const overwrite = (c.req.header("Overwrite") ?? "T").toUpperCase() !== "F";
      const srcUrl = new URL(srcHeader);
      const uaHeader2 = c.req.header("User-Agent");
      const ua2 = typeof uaHeader2 === "string" ? uaHeader2 : "";
      const relax2 = compat.shouldRelaxDepthForDirOps({
        method,
        path: srcUrl.pathname,
        userAgent: ua2,
        getHeader(name: string): string {
          const v = c.req.header(name);
          return typeof v === "string" ? v : "";
        },
      });
      async function depthOk2(): Promise<boolean> {
        if (relax2) { return true; }
        return await checkDepthInfinityRequiredForDir(basePersist, srcUrl.pathname, () => c.req.header("Depth"));
      }
      const okDepth = await depthOk2();
      if (!okDepth) { return send(c, { status: 400 }); }
      const copied = await handleCopyRequest(srcUrl.pathname, p, { persist: basePersist, logger, overwrite });
      return send(c, copied.response);
    }

    if (method === "UNBIND") {
      if (!(await isMethodAllowed(basePersist, p, "UNBIND"))) {
        return send(c, { status: 403 });
      }
      const ok = await requireLockOk(davState, p, c.req.raw.headers, "Lock-Token");
      if (!ok) { return send(c, { status: 423 }); }
      const etagOk = await etagMatchesIfHeader(basePersist, p, c.req.raw.headers);
      if (!etagOk) { return send(c, { status: 412 }); }
      const result = await handleDeleteRequest(p, { persist: basePersist, logger });
      return send(c, result.response);
    }

    if (method === "REBIND") {
      if (!(await isMethodAllowed(basePersist, p, "REBIND"))) {
        return send(c, { status: 403 });
      }
      const destination = c.req.header("Destination");
      if (!destination) { return send(c, { status: 400 }); }
      const overwrite = (c.req.header("Overwrite") ?? "T").toUpperCase() !== "F";
      const destUrl = new URL(destination);
      const uaHeader3 = c.req.header("User-Agent");
      const ua3 = typeof uaHeader3 === "string" ? uaHeader3 : "";
      const relax3 = compat.shouldRelaxDepthForDirOps({
        method,
        path: p,
        userAgent: ua3,
        getHeader(name: string): string {
          const v = c.req.header(name);
          return typeof v === "string" ? v : "";
        },
      });
      async function depthOk3(): Promise<boolean> {
        if (relax3) { return true; }
        return await checkDepthInfinityRequiredForDir(basePersist, p, () => c.req.header("Depth"));
      }
      const okDepth = await depthOk3();
      if (!okDepth) { return send(c, { status: 400 }); }
      const moved = await handleMoveRequest(p, destUrl.pathname, { persist: basePersist, logger, overwrite });
      return send(c, moved.response);
    }

    if (method === "REPORT") {
      if (!(await isMethodAllowed(basePersist, p, "REPORT"))) {
        return send(c, { status: 403 });
      }
      const body = await c.req.text().then((t) => t).catch(() => "");
      const res = await handleReportRequest(p, { persist: basePersist, logger }, body);
      return send(c, res.response);
    }

    if (method === "ORDERPATCH") {
      if (!(await isMethodAllowed(basePersist, p, "ORDERPATCH"))) {
        return send(c, { status: 403 });
      }
      const body = await c.req.text().then((t) => t).catch(() => "");
      const res = await handleOrderpatchRequest(p, body, { persist: basePersist, logger });
      return send(c, res.response);
    }

    await next();
  });

  return app;
}
