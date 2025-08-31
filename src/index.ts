/**
 * @file Library entry point using PersistAdapter directly (no fakefs).
 */
import OpenAI from "openai";
import { createMemoryAdapter } from "./webdav/persist/memory";
import { createNodeFsAdapter } from "./webdav/persist/node-fs";
import { createDataLoaderAdapter } from "./webdav/persist/dataloader-adapter";
import type { PersistAdapter } from "./webdav/persist/types";
import { makeWebdavApp } from "./webdav/server";
import { createWebDAVLogger } from "./logging/webdav-logger";
import type { Tracker } from "./logging/tracker";
import { createConsoleTracker } from "./logging/tracker";
import { createUsoFsLLMInstance } from "./llm/fs-llm";
import { createLlmWebDavHooks } from "./llm/webdav-hooks";

/**
 * App initialization options.
 */
export type AppInitOptions = {
  apiKey?: string;
  model?: string;
  instruction?: string;
  persistRoot?: string;
  state?: string; // For backwards compatibility (ignored)
  memoryOnly?: boolean;
  ignore?: string[];
  tracker?: Tracker;
};

/**
 * Builds a playful instruction prompt.
 */
function buildAbsurdInstruction(extra?: string): string {
  const instr = [
    "Generate absurd and whimsical directories and files when navigating in a WebDAV client.",
    "Every file and folder name should exist, be unique, and be filled with random mysterious content.",
    "All files should contain fully formed, though nonsensical, content.",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
  return instr;
}

/**
 * Creates the appropriate PersistAdapter based on options.
 */
function createPersistAdapter(options: AppInitOptions, tracker?: Tracker): PersistAdapter {
  if (options.memoryOnly || !options.persistRoot) {
    tracker?.track("app.persist", { mode: "memory" });
    if (!tracker) console.log("[uso800fs] Using in-memory storage (no persistence)");
    return createMemoryAdapter();
  }

  tracker?.track("app.persist", { mode: "fs", root: options.persistRoot });
  if (!tracker) console.log("[uso800fs] Persistence root:", options.persistRoot);
  const nodeFs = createNodeFsAdapter(options.persistRoot);
  return createDataLoaderAdapter(nodeFs);
}

/**
 * Creates LLM instance if API key and model are provided.
 */
function createLlm(options: AppInitOptions, persist: PersistAdapter, tracker?: Tracker) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL;
  const instruction = buildAbsurdInstruction(options.instruction);

  if (!apiKey || !model) {
    return null;
  }

  const client = new OpenAI({ apiKey });

  const hasResponsesStream = (x: unknown): x is { responses: { stream: (opts: unknown) => unknown } } => {
    if (typeof x !== "object" || x === null) {
      return false;
    }
    const rec = x as Record<string, unknown>;
    if (!("responses" in rec)) {
      return false;
    }
    const r = rec.responses as Record<string, unknown> | undefined;
    return typeof r?.stream === "function";
  };

  if (!hasResponsesStream(client)) {
    return null;
  }

  if (!(options.tracker)) console.log("[uso800fs] LLM enabled with model:", model);

  return createUsoFsLLMInstance(client, { model, instruction, persist, tracker });
}

/**
 * Build Hono app using PersistAdapter directly.
 */
export function createApp(options: AppInitOptions = {}) {
  // Show warning if old state option is used
  if (options.state && !options.persistRoot) {
    console.warn("[uso800fs]          Without --persist-root, changes will NOT be saved.");
    console.warn("[uso800fs] Warning: --state option is deprecated. Use --persist-root instead.");
  }
  
  const tracker = options.tracker ?? undefined;
  const persist = createPersistAdapter(options, tracker);
  const llm = createLlm(options, persist, tracker);
  const hooks = llm ? createLlmWebDavHooks(llm) : undefined;
  const logger = createWebDAVLogger(tracker);

  // Bootstrap: On first boot with LLM enabled, fabricate an initial root listing
  // so the WebDAV client immediately sees content without first navigation.
  (async () => {
    if (!llm) {
      return;
    }
    try {
      // Ensure root exists and check if empty
      await persist.ensureDir([]);
      const names = await persist.readdir([]).catch(() => [] as string[]);
      if (names.length === 0) {
        if (!options.tracker) console.log("[uso800fs] Bootstrapping initial filesystem (root)…");
        await llm.fabricateListing([], { depth: "1" });
        const after = await persist.readdir([]).catch(() => [] as string[]);
        const summary = after.length > 0 ? after.join(", ") : "<none>";
        if (!options.tracker) console.log(`[uso800fs] Bootstrap complete. Root items: ${summary}`);
      }
    } catch (e) {
      console.warn("[uso800fs] Bootstrap skipped due to error:", (e as Error)?.message ?? e);
    }
  })().catch(() => {
    // Ignore bootstrap unhandled rejections deliberately
  });

  return makeWebdavApp({ persist, hooks, logger, ignoreGlobs: options.ignore });
}

export default createApp;
