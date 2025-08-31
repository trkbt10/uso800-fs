#!/usr/bin/env bun
/**
 * @file Hono-based WebDAV app factory using PersistAdapter directly.
 */
import { Hono, type Context } from "hono";
import {
  handleOptions,
  handlePropfind,
  handleMkcol,
  handleGet,
  handleHead,
  handlePut,
  handleDelete,
  handleMove,
  handleCopy,
  type DavResponse,
} from "./hono-middleware-webdav/handler";
import type { PersistAdapter } from "./persist/types";
import { createWebDAVLogger, type WebDAVLogger } from "./logging/webdav-logger";
import { RequestContextFactory } from "./persist/request-context";

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
}) {
  const basePersist = opts.persist;
  const persistFactory = new RequestContextFactory(basePersist);
  const llm = opts.llm;
  const logger = opts.logger ?? createWebDAVLogger();
  const app = new Hono();

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
    if (logger) {
      logger.logInput("OPTIONS", c.req.path);
    }
    const res = handleOptions(logger);
    return send(c, res);
  });

  app.get("/*", async (c) => {
    const p = c.req.path;
    if (logger) {
      logger.logInput("GET", p);
    }
    
    // Create request-scoped persist context
    const persist = persistFactory.createContext();
    const parts = p.split("/").filter((s) => s);
    
    // Check if file exists
    const exists = await persist.exists(parts);
    if (exists) {
      const res = await handleGet(persist, p, logger);
      return send(c, res);
    }
    
    // If not exists and we have LLM, try to generate content
    if (llm) {
      try {
        const content = await llm.fabricateFileContent(parts);
        if (content) {
          // Ensure parent directory exists
          if (parts.length > 1) {
            await persist.ensureDir(parts.slice(0, -1));
          }
          // Write the generated content
          await persist.writeFile(parts, new TextEncoder().encode(content), "text/plain");
          // Now serve it
          const res = await handleGet(persist, p, logger);
          return send(c, res);
        }
      } catch {
        // Fall through to 404
      }
    }
    
    // Return 404
    if (logger) {
      logger.logOutput("GET", p, 404);
    }
    return send(c, { status: 404 });
  });

  app.on("HEAD", "/*", async (c) => {
    const p = c.req.path;
    if (logger) {
      logger.logInput("HEAD", p);
    }
    const persist = persistFactory.createContext();
    const res = await handleHead(persist, p, logger);
    return send(c, res);
  });

  app.on("PUT", "/*", async (c) => {
    const p = c.req.path;
    if (logger) {
      logger.logInput("PUT", p);
    }
    const persist = persistFactory.createContext();
    const body = await c.req.arrayBuffer();
    const contentType = c.req.header("Content-Type");
    const res = await handlePut(persist, p, new Uint8Array(body), contentType, logger);
    return send(c, res);
  });

  app.on("DELETE", "/*", async (c) => {
    const p = c.req.path;
    if (logger) {
      logger.logInput("DELETE", p);
    }
    const persist = persistFactory.createContext();
    const res = await handleDelete(persist, p, logger);
    return send(c, res);
  });

  // WebDAV-specific methods via c.req.method
  app.use("/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const p = c.req.path;
    
    if (method === "PROPFIND") {
      const depth = c.req.header("Depth") ?? null;
      if (logger) {
        logger.logInput("PROPFIND", p, { depth });
      }
      
      const persist = persistFactory.createContext();
      const parts = p.split("/").filter((s) => s);
      
      // Check if exists
      const exists = await persist.exists(parts);
      if (exists) {
        const res = await handlePropfind(persist, p, depth, logger);
        return send(c, res);
      }
      
      // If not exists and we have LLM, generate listing
      if (llm) {
        try {
          await llm.fabricateListing(parts, { depth });
          const res = await handlePropfind(persist, p, depth, logger);
          return send(c, res);
        } catch {
          // Fall through to 404
        }
      }
      
      // Return 404
      if (logger) {
        logger.logOutput("PROPFIND", p, 404);
      }
      return send(c, { status: 404 });
    }
    
    if (method === "MKCOL") {
      if (logger) {
        logger.logInput("MKCOL", p);
      }
      
      const persist = persistFactory.createContext();
      const parts = p.split("/").filter((s) => s);
      
      // Create directory
      const res = await handleMkcol(persist, p, { 
        logger,
        onGenerate: llm ? async (folder) => {
          try {
            await llm.fabricateListing(folder);
          } catch {
            // Ignore errors
          }
        } : undefined
      });
      
      return send(c, res);
    }
    
    if (method === "MOVE") {
      const destination = c.req.header("Destination");
      if (!destination) {
        return send(c, { status: 400 });
      }
      
      if (logger) {
        logger.logInput("MOVE", p, { destination });
      }
      
      const persist = persistFactory.createContext();
      const destUrl = new URL(destination);
      const res = await handleMove(persist, p, destUrl.pathname, logger);
      return send(c, res);
    }
    
    if (method === "COPY") {
      const destination = c.req.header("Destination");
      if (!destination) {
        return send(c, { status: 400 });
      }
      
      if (logger) {
        logger.logInput("COPY", p, { destination });
      }
      
      const persist = persistFactory.createContext();
      const destUrl = new URL(destination);
      const res = await handleCopy(persist, p, destUrl.pathname, logger);
      return send(c, res);
    }
    
    await next();
  });
  
  return app;
}