/**
 * @file Library entry point using PersistAdapter directly (no fakefs).
 */
import OpenAI from "openai";
import { createMemoryAdapter } from "./webdav/persist/memory";
import { createNodeFsAdapter } from "./webdav/persist/node-fs";
import type { PersistAdapter } from "./webdav/persist/types";
import { makeWebdavApp } from "./webdav/server";
import { createWebDAVLogger } from "./logging/webdav-logger";
import type { Tracker } from "./logging/tracker";
// createConsoleTracker is not used; keep Tracker types only.
import { createUsoFsLLMInstance } from "./llm/fs-llm";
import type { ImageGenerationProvider, ImageKind, ImageSize } from "./image-generation/types";
import { createLlmWebDavHooks } from "./llm/webdav-hooks";
import { bootstrapInitialFs } from "./bootstrap";

/**
 * App initialization options.
 */
export type AppInitOptions = {
  apiKey?: string;
  model?: string;
  instruction?: string;
  textInstruction?: string;
  imageInstruction?: string;
  persistRoot?: string;
  state?: string; // For backwards compatibility (ignored)
  memoryOnly?: boolean;
  ignore?: string[];
  tracker?: Tracker;
  image?: {
    provider: ImageGenerationProvider;
    repoId: string | number;
    kind: ImageKind;
    sizes: ImageSize[];
    style?: string;
    negative?: string;
    n?: number;
  };
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
    if (!tracker) {
      console.log("[uso800fs] Using in-memory storage (no persistence)");
    }
    return createMemoryAdapter();
  }

  tracker?.track("app.persist", { mode: "fs", root: options.persistRoot });
  if (!tracker) {
    console.log("[uso800fs] Persistence root:", options.persistRoot);
  }
  const nodeFs = createNodeFsAdapter(options.persistRoot);
  // Use raw Node FS here; per-request caching is applied in the WebDAV app
  return nodeFs;
}

/**
 * Creates LLM instance if API key and model are provided.
 */
function createLlm(options: AppInitOptions, persist: PersistAdapter, tracker?: Tracker) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL;
  const instruction = buildAbsurdInstruction(options.instruction);
  const textInstruction = options.textInstruction;
  const imageInstruction = options.imageInstruction;

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

  if (!(options.tracker)) {
    console.log("[uso800fs] LLM enabled with model:", model);
  }

  const image = buildImageConfig(options.image);

  return createUsoFsLLMInstance(client, { 
    model, 
    instruction, 
    textInstruction,
    imageInstruction,
    persist, 
    tracker, 
    image 
  });
}

function buildImageConfig(image?: AppInitOptions["image"]) {
  if (!image) {
    return undefined;
  }
  const { provider, repoId, kind, sizes, style, negative, n } = image;
  if (!provider || !repoId || !kind || !Array.isArray(sizes) || sizes.length === 0) {
    throw new Error("image option requires provider, repoId, kind, and at least one size");
  }
  return {
    provider,
    repoId,
    kind,
    request: { sizes, style: style ?? "", negative, n },
  };
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

  // Bootstrap using shared helper; no-op when llm is not present
  void bootstrapInitialFs(persist, { fabricateListing: llm?.fabricateListing, silent: Boolean(options.tracker) });

  return makeWebdavApp({ persist, hooks, logger, ignoreGlobs: options.ignore });
}

export default createApp;
