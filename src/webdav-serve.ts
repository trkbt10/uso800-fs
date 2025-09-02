#!/usr/bin/env bun
/**
 * @file Minimal WebDAV server that mounts a single local folder without LLM.
 * It uses the Node FS PersistAdapter and Hono-based WebDAV app, suitable for
 * verifying raw WebDAV semantics (create/delete/rename/move/listing) against
 * an existing directory tree.
 */
import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { makeWebdavApp } from "./webdav/server";
import { createNodeFsAdapter } from "./webdav/persist/node-fs";
import { createDataLoaderAdapter } from "./webdav/persist/dataloader-adapter";
import { createWebDAVLogger } from "./logging/webdav-logger";

/**
 * Parsed CLI options for the standalone server.
 */
type ServeOptions = {
  root: string;
  port: number;
  host: string;
};

/**
 * Parses command-line arguments.
 * Supported flags: --root|-r <dir>, --port|-p <port>, --host <host>
 */
function parseArgs(argv: string[]): ServeOptions {
  const args = argv.slice(2);
  function valueOf(longFlag: string, shortFlag?: string): string | undefined {
    const i = args.findIndex((x) => {
      if (x === longFlag) { return true; }
      if (shortFlag) { return x === shortFlag; }
      return false;
    });
    if (i >= 0) {
      const v = args[i + 1];
      if (typeof v === "string" && v.length > 0) {
        return v;
      }
      throw new Error(`${longFlag} requires a value`);
    }
    return undefined;
  }

  const rootRaw = valueOf("--root", "-r");
  if (!rootRaw) {
    throw new Error("Missing required --root <dir> argument");
  }
  const portRaw = valueOf("--port", "-p");
  const port = (() => {
    if (!portRaw) {
      return 8080;
    }
    const n = Number(portRaw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("--port requires a positive number");
    }
    return n;
  })();
  const host = valueOf("--host") ?? "127.0.0.1";

  return { root: resolve(process.cwd(), rootRaw), port, host };
}

/**
 * Starts the WebDAV server mounting the specified folder.
 */
async function main(): Promise<void> {
  try {
    const opts = parseArgs(process.argv);

    if (!existsSync(opts.root)) {
      mkdirSync(opts.root, { recursive: true });
    }

    const nodeFs = createNodeFsAdapter(opts.root);
    const persist = createDataLoaderAdapter(nodeFs);
    const logger = createWebDAVLogger();
  const app = makeWebdavApp({ persist, logger, relaxDepthForDirOps: "auto" });

    serve({ fetch: app.fetch, port: opts.port, hostname: opts.host });

    console.log(`[webdav-serve] Mounted '${opts.root}' on http://${opts.host}:${opts.port}`);
    console.log("[webdav-serve] No LLM, pure filesystem exposure via WebDAV");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webdav-serve]", msg);
    console.error("Usage: bun src/webdav-serve.ts --root <dir> [--port 8080] [--host 127.0.0.1]");
    process.exit(1);
  }
}

void main();
