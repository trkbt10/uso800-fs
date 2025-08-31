#!/usr/bin/env bun
/**
 * @file Hono-based WebDAV app factory. LLM/Persist は index.ts から注入する（no-magic）。
 */
import { Hono, type Context } from "hono";
import { type FsState, getEntry, ensureDir, putFile } from "./fakefs/state";
import {
  handleOptions,
  handlePropfind,
  handleMkcol,
  handleGet,
  handleHead,
  type DavResponse,
} from "./hono-middleware-webdav/handler";
import type { PersistAdapter } from "./persist/types";

// per-app dependency types
export type LlmLike = {
  fabricateListing: (path: string[]) => Promise<void>;
  fabricateFileContent: (path: string[]) => Promise<string>;
};
export type LlmFactory = (a: { state: FsState }) => LlmLike;

/**
 * Creates a WebDAV Hono app bound to the given in-memory FsState.
 * statePath is used to persist JSON snapshots after mutations.
 */
export function makeWebdavApp(opts: {
  state: FsState;
  statePath?: string;
  deps: { persist?: PersistAdapter; llm?: LlmLike };
}) {
  const state = opts.state;
  // statePath is currently unused because persistence is handled via PersistAdapter
  const persist = opts.deps.persist;
  const currentLlm = opts.deps.llm;
  const app = new Hono();
  const hasLLM = () => typeof currentLlm !== "undefined";

  async function syncFolderToPersist(parts: string[]) {
    if (!persist) {
      return;
    }
    await persist.ensureDir(parts);
    const dir = getEntry(state, parts);
    if (!dir || dir.type !== "dir") {
      return;
    }
    for (const [name, child] of dir.children.entries()) {
      const next = [...parts, name];
      if (child.type === "dir") {
        await persist.ensureDir(next);
        await syncFolderToPersist(next);
      } else {
        const data = new TextEncoder().encode(child.content ?? "");
        await persist.writeFile(next, data, child.mime);
      }
    }
  }

  async function syncFileToPersist(parts: string[]) {
    if (!persist) {
      return;
    }
    const e = getEntry(state, parts);
    if (!e || e.type !== "file") {
      return;
    }
    const data = new TextEncoder().encode(e.content ?? "");
    await persist.ensureDir(parts.slice(0, -1));
    await persist.writeFile(parts, data, e.mime);
  }

  /**
   * Attempts to populate state from persistence for a folder path.
   */
  async function loadFolderFromPersist(parts: string[]) {
    if (!persist) {
      return;
    }
    const exists = await persist.exists(parts);
    if (!exists) {
      return;
    }
    ensureDir(state, parts);
    const names = await persist.readdir(parts);
    for (const name of names) {
      const childPath = [...parts, name];
      const st = await persist.stat(childPath);
      if (st.type === "dir") {
        ensureDir(state, childPath);
        await loadFolderFromPersist(childPath);
      } else {
        const data = await persist.readFile(childPath);
        const content = new TextDecoder().decode(data);
        putFile(state, childPath, content);
      }
    }
  }

  /**
   * Attempts to populate state from persistence for a file path.
   */
  async function loadFileFromPersist(parts: string[]) {
    if (!persist) {
      return false;
    }
    const exists = await persist.exists(parts);
    if (!exists) {
      return false;
    }
    const data = await persist.readFile(parts);
    const content = new TextDecoder().decode(data);
    ensureDir(state, parts.slice(0, -1));
    putFile(state, parts, content);
    return true;
  }

  /**
   * Sends a DavResponse through Hono's Context with proper headers.
   */
  function logWeb(stage: "request" | "response", c: Context, extra?: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      type: "webdav",
      stage,
      ts: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
    };
    if (extra && typeof extra === "object") {
      for (const [k, v] of Object.entries(extra)) {
        payload[k] = v;
      }
    }
    console.log("[uso800fs][webdav] " + JSON.stringify(payload));
  }

  function send(c: Context, res: DavResponse, info?: Record<string, unknown>) {
    logWeb("response", c, { status: res.status, ...info });
    const init: ResponseInit = { status: res.status, headers: res.headers };
    const body = (res.body ?? "") as BodyInit;
    return new Response(body, init);
  }

  app.all("*", async (c, next) => {
    // Basic CORS and DAV headers
    c.header("DAV", "1,2");
    c.header("MS-Author-Via", "DAV");
    c.header("Allow", "OPTIONS, PROPFIND, MKCOL, GET, HEAD");
    const depth = c.req.header("Depth");
    if (typeof depth === "string") {
      logWeb("request", c, { depth });
    } else {
      logWeb("request", c);
    }
    await next();
  });

  app.options("/*", (c) => {
    const res = handleOptions();
    return send(c, res);
  });

  app.get("/*", async (c) => {
    const p = c.req.path;
    const initial = handleGet(state, p);
    if (initial.status !== 404) {
      return send(c, initial, { source: "state" });
    }
    const parts = p.split("/").filter((s) => s);
    if (await loadFileFromPersist(parts)) {
      return send(c, handleGet(state, p), { source: "persist" });
    }
    if (!hasLLM()) {
      return send(c, initial, { source: "none" });
    }
    const llm = currentLlm;
    if (!llm) {
      return send(c, initial, { source: "none" });
    }
    const text = await llm.fabricateFileContent(parts);
    if (text && typeof text === "string") {
      const mime = "text/plain";
      ensureDir(state, parts.slice(0, -1));
      putFile(state, parts, text, mime);
      await syncFileToPersist(parts);
      return send(c, handleGet(state, p), { source: "llm" });
    }
    return send(c, initial, { source: "none" });
  });

  app.on("HEAD", "/*", (c) => {
    const p = c.req.path;
    const res = handleHead(state, p);
    return send(c, res, { source: "state" });
  });

  // WebDAV-specific methods via c.req.method
  app.use("/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const p = c.req.path;
    if (method === "PROPFIND") {
      const depth = c.req.header("Depth") ?? null;
      const initial = handlePropfind(state, p, depth);
      if (initial.status !== 404) {
        return send(c, initial, { source: "state" });
      }
      const parts = p.split("/").filter((s) => s);
      await loadFolderFromPersist(parts);
      const afterPersist = handlePropfind(state, p, depth);
      if (afterPersist.status !== 404) {
        return send(c, afterPersist, { source: "persist" });
      }
      if (!hasLLM()) {
        return send(c, initial, { source: "none" });
      }
      const llm = currentLlm;
      if (!llm) {
        return send(c, initial, { source: "none" });
      }
      await llm.fabricateListing(parts);
      await syncFolderToPersist(parts);
      return send(c, handlePropfind(state, p, depth), { source: "llm" });
    }
    if (method === "MKCOL") {
      const parts = p.split("/").filter((s) => s);
      const res = handleMkcol(state, p);
      // Prefer LLM-driven listing if available
      if (hasLLM()) {
        const llm = currentLlm;
        if (llm) {
          await llm.fabricateListing(parts);
        }
        await syncFolderToPersist(parts);
        return send(c, res, { llmUsed: true });
      }
      await syncFolderToPersist(parts);
      return send(c, res, { llmUsed: false });
    }
    await next();
  });
  return app;
}
