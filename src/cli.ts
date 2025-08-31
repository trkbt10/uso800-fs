#!/usr/bin/env node
/**
 * @file Node.js CLI entry using @hono/node-server to serve the Hono app.
 */
import { serve } from "@hono/node-server";
import createApp from "./index";
import { pathToFileURL } from "node:url";

function parseCli(argv: string[]) {
  const out: { port?: number; state?: string; model?: string; instruction?: string; persistRoot?: string } = {};
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
    if (a === "--model") {
      out.model = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--instruction") {
      out.instruction = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--persist-root") {
      out.persistRoot = argv[i + 1];
      i += 1;
      continue;
    }
  }
  return out;
}

/**
 * Starts the application from the command line interface.
 */
export function startFromCli() {
  /**
   * Parses CLI args and returns a Hono-compatible app object with a port.
   * Does not start the HTTP server; caller decides how to serve it.
   */
  const args = parseCli(process.argv.slice(2));
  const app = createApp({
    state: args.state,
    persistRoot: args.persistRoot,
    model: args.model,
    instruction: args.instruction,
  });
  const maybeApp = app as HonoLike;
  if (!hasFetcher(maybeApp)) {
    throw new Error("Hono app is missing fetch");
  }
  const port = typeof args.port === "number" && !Number.isNaN(args.port) ? args.port : 8787;
  return { ...maybeApp, port } as { fetch: HonoLike["fetch"]; port: number };
}

type HonoLike = {
  fetch?: (req: Request) => Response | Promise<Response>;
  port?: number;
};

function hasFetcher(x: HonoLike): x is { fetch: (req: Request) => Response | Promise<Response>; port?: number } {
  return typeof x.fetch === "function";
}

// Auto-run only when executed directly
if (import.meta && typeof import.meta.url === "string") {
  const entry = process.argv[1];
  const isMain = entry ? import.meta.url === pathToFileURL(entry).toString() : false;
  if (isMain) {
    const appWithPort = startFromCli();
    serve({ fetch: appWithPort.fetch!.bind(appWithPort), port: appWithPort.port, hostname: "127.0.0.1" });
    console.log(`[uso800fs] WebDAV server listening on 127.0.0.1:${appWithPort.port}`);
  }
}
