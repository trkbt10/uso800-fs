#!/usr/bin/env bun
/**
 * @file Hono-based WebDAV app factory using PersistAdapter directly.
 */
import { Hono, type Context } from "hono";
import { handleOptions, type DavResponse } from "./hono-middleware-webdav/handler";
import type { PersistAdapter } from "./persist/types";
import { createWebDAVLogger, type WebDAVLogger } from "./logging/webdav-logger";
import { RequestContextFactory } from "./persist/request-context";
import { buildIgnoreRegexps, isIgnoredFactory } from "./server/ignore";
import {
  handleGetRequest,
  handlePutRequest,
  handlePropfindRequest,
  handleMkcolRequest,
  handleHeadRequest,
  handleDeleteRequest,
  handleMoveRequest,
  handleCopyRequest,
  createMkcolOnGenerate,
} from "./server/handlers";

// LLM interface for generating content
export type LlmLike = {
  fabricateListing: (path: string[], opts?: { depth?: string | null }) => Promise<void>;
  fabricateFileContent: (path: string[], opts?: { mimeHint?: string }) => Promise<string>;
};

/**
 * Creates a WebDAV Hono app using PersistAdapter directly.
 */
export function makeWebdavApp(opts: {
  persist: PersistAdapter;
  llm?: LlmLike;
  logger?: WebDAVLogger;
  ignoreGlobs?: string[];
}) {
  const basePersist = opts.persist;
  const persistFactory = new RequestContextFactory(basePersist);
  const llm = opts.llm;
  const logger = opts.logger ?? createWebDAVLogger();
  const app = new Hono();

  const ignoreRes = buildIgnoreRegexps(opts.ignoreGlobs);
  const isIgnored = isIgnoredFactory(ignoreRes);

  /**
   * Sends a DavResponse through Hono's Context with proper headers.
   */
  function send(c: Context, res: DavResponse) {
    const init: ResponseInit = { status: res.status, headers: res.headers };
    const body = (res.body ?? "") as BodyInit;
    return new Response(body, init);
  }

  app.all("*", async (c, next) => {
    // Basic CORS and DAV headers
    c.header("DAV", "1,2");
    c.header("MS-Author-Via", "DAV");
    c.header("Allow", "OPTIONS, PROPFIND, MKCOL, GET, HEAD, PUT, DELETE, MOVE, COPY");
    await next();
  });

  app.options("/*", (c) => {
    logger?.logInput("OPTIONS", c.req.path);
    return send(c, handleOptions(logger));
  });

  // Small helper to short-circuit ignored paths with logging
  function maybeIgnore(c: Context, method: string): Response | null {
    const p = c.req.path;
    logger?.logInput(method, p);
    if (isIgnored(p)) {
      logger?.logOutput(method, p, 404);
      return send(c, { status: 404 });
    }
    return null;
  }

  app.get("/*", async (c) => {
    const ignored = maybeIgnore(c, "GET");
    if (ignored) { return ignored; }
    const p = c.req.path;
    const persist = persistFactory.createContext();
    const result = await handleGetRequest(p, { persist, llm, logger });
    return send(c, result.response);
  });

  app.on("HEAD", "/*", async (c) => {
    const ignored = maybeIgnore(c, "HEAD");
    if (ignored) { return ignored; }
    const p = c.req.path;
    const persist = persistFactory.createContext();
    const result = await handleHeadRequest(p, { persist, logger });
    return send(c, result.response);
  });

  app.on("PUT", "/*", async (c) => {
    const p = c.req.path;
    const persist = persistFactory.createContext();
    const body = await c.req.arrayBuffer();
    
    // Use the tested handler
    const result = await handlePutRequest(p, body, { persist, llm, logger });
    return send(c, result.response);
  });

  app.on("DELETE", "/*", async (c) => {
    logger?.logInput("DELETE", c.req.path);
    const p = c.req.path;
    const persist = persistFactory.createContext();
    const result = await handleDeleteRequest(p, { persist, logger });
    return send(c, result.response);
  });

  // WebDAV-specific methods via c.req.method
  app.use("/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const p = c.req.path;

    if (method === "PROPFIND") {
      const depth = c.req.header("Depth") ?? null;
      
      // Ignore paths return 404 to avoid spurious LIST logs for noise files
      if (isIgnored(p)) { logger?.logOutput("PROPFIND", p, 404); return send(c, { status: 404 }); }

      const persist = persistFactory.createContext();
      
      // Use the tested handler with ignore filtering
      const result = await handlePropfindRequest(p, depth, { 
        persist, 
        llm, 
        logger,
        shouldIgnore: (full, base) => {
          if (isIgnored(full)) { return true; }
          if (isIgnored(base)) { return true; }
          return false;
        }
      });
      
      return send(c, result.response);
    }

    if (method === "MKCOL") {
      const persist = persistFactory.createContext();
      
      // Use the tested handler with onGenerate callback
      const onGenerate = createMkcolOnGenerate(llm);
      const result = await handleMkcolRequest(p, { persist, llm, logger, onGenerate });
      
      return send(c, result.response);
    }

    if (method === "MOVE") {
      const destination = c.req.header("Destination");
      if (!destination) {
        return send(c, { status: 400 });
      }

      const persist = persistFactory.createContext();
      const destUrl = new URL(destination);
      const result = await handleMoveRequest(p, destUrl.pathname, { persist, logger });
      return send(c, result.response);
    }

    if (method === "COPY") {
      const destination = c.req.header("Destination");
      if (!destination) {
        return send(c, { status: 400 });
      }

      const persist = persistFactory.createContext();
      const destUrl = new URL(destination);
      const result = await handleCopyRequest(p, destUrl.pathname, { persist, logger });
      return send(c, result.response);
    }

    await next();
  });

  return app;
}
