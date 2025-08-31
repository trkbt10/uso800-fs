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
  llm: LlmLike;
  logger?: WebDAVLogger;
  ignoreGlobs?: string[];
}) {
  const basePersist = opts.persist;
  const persistFactory = new RequestContextFactory(basePersist);
  const llm = opts.llm;
  const logger = opts.logger ?? createWebDAVLogger();
  const app = new Hono();

  function splitPath(pathname: string): string[] {
    return pathname.split("/").filter((s) => s);
  }

  function globToRegExp(glob: string): RegExp {
    // Normalize path to POSIX-style
    const g = glob.replace(/\\/g, "/");
    // Escape regex chars, then restore globs
    const re = g
      .replace(/[.+^${}()|\[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "(?:.*/)?")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");
    return new RegExp(`^${re}$`);
  }

  function buildIgnoreRegexps(globs: string[] | undefined): RegExp[] {
    const defaults = [
      "**/._*",
      "**/.DS_Store",
      "**/Thumbs.db",
      "**/desktop.ini",
      "**/.Spotlight-V100",
      "**/.Trashes",
      "**/.fseventsd",
    ];
    const all = [...defaults, ...(globs ?? [])];
    return all.map((p) => globToRegExp(p));
  }

  const ignoreRes = buildIgnoreRegexps(opts.ignoreGlobs);

  function isIgnored(pathname: string): boolean {
    const p = pathname.replace(/\\/g, "/");
    // Match against full path and also basename for convenience
    const parts = splitPath(p);
    const base = parts[parts.length - 1] ?? "";
    for (const r of ignoreRes) {
      if (r.test(p) || r.test(base)) {
        return true;
      }
    }
    return false;
  }

  function buildEmptyPropfindXmlSelf(urlPath: string): string {
    const parts = splitPath(urlPath);
    const selfHref = urlPath.endsWith("/") ? urlPath : urlPath + "/";
    const display = parts[parts.length - 1] || "/";
    const xml = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">\n\n<D:response>\n  <D:href>${selfHref}</D:href>\n  <D:propstat>\n    <D:prop>\n      <D:displayname>${display}</D:displayname>\n      <D:getcontentlength>0</D:getcontentlength>\n      <D:resourcetype></D:resourcetype>\n    </D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>\n</D:response>\n\n</D:multistatus>`;
    return xml;
  }

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
    if (isIgnored(p)) {
      if (logger) {
        logger.logOutput("GET", p, 404);
      }
      return send(c, { status: 404 });
    }
    
    // Create request-scoped persist context
    const persist = persistFactory.createContext();
    const parts = p.split("/").filter((s) => s);
    
    // Check if file exists
    const exists = await persist.exists(parts);
    if (exists) {
      // If it's an empty file, generate content via LLM once.
      try {
        const st = await persist.stat(parts);
        if (st.type === "file" && (st.size ?? 0) === 0) {
          const content = await llm.fabricateFileContent(parts);
          if (content) {
            if (parts.length > 1) {
              await persist.ensureDir(parts.slice(0, -1));
            }
            await persist.writeFile(parts, new TextEncoder().encode(content), "text/plain");
          }
        }
      } catch {
        // ignore stat errors
      }
      const res = await handleGet(persist, p, logger);
      return send(c, res);
    }
    
    // If not exists, generate content via LLM
    try {
      const content = await llm.fabricateFileContent(parts);
      if (content) {
        if (parts.length > 1) {
          await persist.ensureDir(parts.slice(0, -1));
        }
        await persist.writeFile(parts, new TextEncoder().encode(content), "text/plain");
        const res = await handleGet(persist, p, logger);
        return send(c, res);
      }
    } catch {
      // Fall through to 404
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
    if (isIgnored(p)) {
      if (logger) {
        logger.logOutput("HEAD", p, 404);
      }
      return send(c, { status: 404 });
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
    let data = new Uint8Array(body);
    if (data.byteLength === 0) {
      const parts = p.split("/").filter((s) => s);
      const content = await llm.fabricateFileContent(parts);
      if (content) {
        data = new TextEncoder().encode(content);
      }
    }
    const res = await handlePut(persist, p, data, contentType, logger);
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
      // Fast path for common noise/metadata files (AppleDouble, DS_Store, Thumbs.db, etc.)
      if (isIgnored(p)) {
        const xml = buildEmptyPropfindXmlSelf(p);
        if (logger) {
          logger.logList(p, 207, 0);
        }
        return send(c, { status: 207, headers: { "Content-Type": "application/xml" }, body: xml });
      }
      
      const persist = persistFactory.createContext();
      const parts = p.split("/").filter((s) => s);
      
      // Check if exists
      const exists = await persist.exists(parts);
      if (exists) {
        // If directory exists but is empty, ask LLM to fabricate a listing once.
        try {
          const st = await persist.stat(parts);
          if (st.type === "dir") {
            const names = await persist.readdir(parts);
            if (names.length === 0) {
              await llm.fabricateListing(parts, { depth });
              const persist2 = persistFactory.createContext();
              const res = await handlePropfind(persist2, p, depth, logger);
              return send(c, res);
            }
          }
        } catch {
          // ignore
        }
        const res = await handlePropfind(persist, p, depth, logger);
        return send(c, res);
      }
      
      // If not exists, generate listing
      try {
        await llm.fabricateListing(parts, { depth });
        const persist2 = persistFactory.createContext();
        const res = await handlePropfind(persist2, p, depth, logger);
        return send(c, res);
      } catch {
        // Fall through to 404
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
        onGenerate: async (folder) => {
          try {
            await llm.fabricateListing(folder);
          } catch {
            // Ignore errors
          }
        },
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
