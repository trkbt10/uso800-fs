/**
 * @file Library entry point using PersistAdapter directly (no fakefs).
 */
import OpenAI from "openai";
import { createMemoryAdapter } from "./persist/memory";
import { createNodeFsAdapter } from "./persist/node-fs";
import { createDataLoaderAdapter } from "./persist/dataloader-adapter";
import type { PersistAdapter } from "./persist/types";
import { makeWebdavApp, type LlmLike } from "./server";
import { createWebDAVLogger } from "./logging/webdav-logger";
import { createUsoFsLLMInstance } from "./llm/fs-llm";

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
function createPersistAdapter(options: AppInitOptions): PersistAdapter {
  if (options.memoryOnly || !options.persistRoot) {
    // Use in-memory adapter
    console.log("[uso800fs] Using in-memory storage (no persistence)");
    return createMemoryAdapter();
  }
  
  // Use file system adapter with DataLoader
  console.log("[uso800fs] Persistence root:", options.persistRoot);
  const nodeFs = createNodeFsAdapter(options.persistRoot);
  return createDataLoaderAdapter(nodeFs);
}

/**
 * Creates LLM instance if API key and model are provided.
 */
function createLlm(options: AppInitOptions, persist: PersistAdapter): LlmLike | undefined {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL;
  const instruction = buildAbsurdInstruction(options.instruction);
  
  if (!apiKey || !model) {
    console.log("[uso800fs] LLM disabled (no API key or model)");
    return undefined;
  }
  
  const client = new OpenAI({ apiKey });
  
  // Check if client has responses API
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
    console.log("[uso800fs] LLM disabled (no responses API)");
    return undefined;
  }
  
  console.log("[uso800fs] LLM enabled with model:", model);
  
  return createUsoFsLLMInstance(client, { 
    model, 
    instruction, 
    persist 
  });
}

/**
 * Build Hono app using PersistAdapter directly.
 */
export function createApp(options: AppInitOptions = {}) {
  // Show warning if old state option is used
  if (options.state && !options.persistRoot) {
    console.warn("[uso800fs] Warning: --state option is deprecated. Use --persist-root instead.");
    console.warn("[uso800fs]          State files are no longer used; data is managed by PersistAdapter.");
  }
  
  const persist = createPersistAdapter(options);
  const llm = createLlm(options, persist);
  const logger = createWebDAVLogger();
  
  return makeWebdavApp({ persist, llm, logger });
}

export default createApp;