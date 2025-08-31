#!/usr/bin/env node
/**
 * @file Node.js CLI entry using @hono/node-server to serve the Hono app.
 */
import { serve } from "@hono/node-server";
import createApp from "./index";
import { pathToFileURL } from "node:url";

function showHelp() {
  console.log(`
uso800fs - WebDAV Fake Filesystem Server

USAGE:
  bun run src/cli.ts [OPTIONS]

OPTIONS:
  --port <number>           HTTP port (default: 8787)
  --persist-root <dir>      Directory for persisting generated content
  --model <name>            OpenAI model for LLM fabrication (requires OPENAI_API_KEY)
  --instruction <text>      Extra instruction for LLM content generation
  --state <path>            Load initial filesystem snapshot (deprecated)
  --ignore <pattern>        Ignore pattern for filesystem operations (can be repeated)
  --ui                      Enable fullscreen terminal UI with real-time monitoring
  -h, --help                Show this help message

EXAMPLES:
  # Basic in-memory server
  bun run src/cli.ts --port 8787

  # With persistence
  bun run src/cli.ts --port 8787 --persist-root ./debug/fakefs

  # With LLM fabrication
  OPENAI_API_KEY=sk-... bun run src/cli.ts --port 8787 --persist-root ./debug/fakefs --model gpt-4o-mini

  # With interactive UI
  bun run src/cli.ts --ui --port 8787 --persist-root ./debug/fakefs --model gpt-4o-mini

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY            OpenAI API key for LLM features
  OPENAI_MODEL              Default model if --model is not specified
`);
}

function parseCli(argv: string[]) {
  const out: { port?: number; state?: string; model?: string; instruction?: string; persistRoot?: string; ignore?: string[]; ui?: boolean; help?: boolean } = {};
  
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      out.help = true;
      return out;
    }
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
    if (a === "--ignore") {
      const pat = argv[i + 1];
      if (typeof pat === "string" && pat.length > 0) {
        out.ignore = [...(out.ignore ?? []), pat];
      }
      i += 1;
      continue;
    }
    if (a === "--ui") {
      out.ui = true;
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
  
  // Show help and exit if requested
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Optional UI tracker hookup
  let tracker: import("./logging/tracker").Tracker | undefined;
  if (args.ui) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storeMod = require("./ink/store");
    const created = storeMod.createTrackStore();
    tracker = created.tracker;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      try {
        const ui = await import("./ink/ui");
        ui.runInkUI(created.globalStore);
      } catch (e) {
        console.warn("[uso800fs] UI unavailable:", (e as Error)?.message ?? e);
      }
    })();
  }

  const app = createApp({
    state: args.state,
    persistRoot: args.persistRoot,
    model: args.model,
    instruction: args.instruction,
    ignore: args.ignore,
    tracker,
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
    const args = parseCli(process.argv.slice(2));
    if (args.ui) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const storeMod = require("./ink/store");
        const state = storeMod.globalStore?.getState?.();
        const tracker = (storeMod.createTrackStore?.() ?? {}).tracker;
        tracker?.track("app.port", { host: "127.0.0.1", port: appWithPort.port });
      } catch {
        // ignore
      }
    } else {
      console.log(`[uso800fs] WebDAV server listening on 127.0.0.1:${appWithPort.port}`);
    }
  }
}
