#!/usr/bin/env bun
/**
 * Hono-based HTTP server with WebDAV endpoints backed by a virtual fake filesystem.
 *
 * Requires: bun add hono
 */
import { Hono } from "hono";
import { serve } from "hono/bun";
import { createFsState, toPlain, fromPlain } from "./fakefs/state";
import { handleOptions, handlePropfind, handleMkcol, handleGet, handleHead } from "./webdav/handler";

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function parseArgs(argv: string[]) {
  const out: { port?: number; state?: string; actions?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--port") {
      out.port = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--state") {
      out.state = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--actions") {
      out.actions = argv[i + 1];
      i += 1;
      continue;
    }
  }
  if (!out.port || out.port <= 0) {
    throw new Error("--port is required and must be positive");
  }
  return out;
}

function loadState(path?: string) {
  if (path && existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return { state: fromPlain(raw), statePath: path };
  }
  return { state: createFsState(), statePath: path };
}

function saveState(state: ReturnType<typeof loadState>["state"], path?: string) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(toPlain(state.root), null, 2));
}

const args = parseArgs(process.argv.slice(2));
const { state, statePath } = loadState(args.state);

const app = new Hono();

app.all("*", async (c, next) => {
  // Basic CORS and DAV headers
  c.header("DAV", "1,2");
  c.header("MS-Author-Via", "DAV");
  c.header("Allow", "OPTIONS, PROPFIND, MKCOL, GET, HEAD");
  await next();
});

app.options("/*", (c) => {
  const res = handleOptions();
  for (const [k, v] of Object.entries(res.headers ?? {})) c.header(k, v);
  return c.body(res.body ?? "", res.status);
});

app.route("/*")
  .get((c) => {
    const p = c.req.path;
    const res = handleGet(state, p);
    for (const [k, v] of Object.entries(res.headers ?? {})) c.header(k, v);
    return c.body(res.body ?? "", res.status);
  })
  .head((c) => {
    const p = c.req.path;
    const res = handleHead(state, p);
    for (const [k, v] of Object.entries(res.headers ?? {})) c.header(k, v);
    return c.body("", res.status);
  });

// WebDAV-specific methods via c.req.method
app.use("/*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  const p = c.req.path;
  if (method === "PROPFIND") {
    const depth = c.req.header("Depth") ?? null;
    const res = handlePropfind(state, p, depth);
    for (const [k, v] of Object.entries(res.headers ?? {})) c.header(k, v);
    return c.body(res.body ?? "", res.status);
  }
  if (method === "MKCOL") {
    const res = handleMkcol(state, p);
    for (const [k, v] of Object.entries(res.headers ?? {})) c.header(k, v);
    saveState(state, statePath);
    return c.body(res.body ?? "", res.status);
  }
  await next();
});

serve({ fetch: app.fetch, port: args.port });
console.log(`[uso800fs] WebDAV server listening on 127.0.0.1:${args.port}`);

