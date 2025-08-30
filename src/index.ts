/**
 * @file Library entry. 起動オプションの処理と依存注入を行う。
 * 環境変数はこのファイルからのみ参照する（no-magic）。
 */
import OpenAI from "openai";
import { createUsoFsLLMInstance } from "./llm/fs-llm";
import { createNodeFsAdapter } from "./persist/node-fs";
import type { PersistAdapter } from "./persist/types";
import { makeWebdavApp, type LlmFactory } from "./server";
import { readFileSync, existsSync } from "node:fs";
import { createFsState, fromPlain, type FsState } from "./fakefs/state";
// no direct snapshot writing here; server handles save on mutations

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
 * Builds a playful instruction prompt to encourage silly outputs.
 */
function buildAbsurdInstruction(extra?: string): string {
  const base = [
    "You are USO800 Gremlin, a chaotic filesystem fabricator.",
    "Goal: produce ludicrous directory listings and file contents for a fake FS.",
    "- Only use tools (no plain text): emit_fs_listing, emit_file_content",
    "- Prefer bizarre names (e.g., '🤡-noises', '000-SILLY', 'wow_such_dir')",
    "- File content: playful nonsense, ASCII art, mock changelogs, haiku, fake TODOs",
    "- Be safe and non-offensive; avoid real identities or secrets",
    "- Keep outputs small and cohesive for fast demos",
  ].join("\n");
  return extra ? `${base}\n\nEXTRA:\n${extra}` : base;
}

/**
 * Parses CLI/env, injects dependencies, and returns the Hono app.
 */
export function startFromCli() {
  const args = parseCli(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  const model = args.model ?? process.env.OPENAI_MODEL;
  const instruction = buildAbsurdInstruction(args.instruction);

  const persist: PersistAdapter | undefined = args.persistRoot ? createNodeFsAdapter(args.persistRoot) : undefined;
  if (persist && args.persistRoot) {
    console.log("[uso800fs] Persistence root:", args.persistRoot);
  }

  const llmFactory: LlmFactory | undefined = (() => {
    if (!apiKey || !model) {
      return undefined;
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
      return undefined;
    }
    console.log("[uso800fs] LLM enabled with model:", model);
    return ({ state }) => createUsoFsLLMInstance(client, { model, instruction, state });
  })();

  // Load initial state JSON if provided
  const state: FsState = (() => {
    if (args.state && existsSync(args.state)) {
      const raw = JSON.parse(readFileSync(args.state, "utf8"));
      const root = fromPlain(raw);
      if (root.type !== "dir") {
        throw new Error("Invalid state file: root must be a directory");
      }
      return { root };
    }
    return createFsState();
  })();

  // Build Hono app
  const app = makeWebdavApp({ state, statePath: args.state, deps: { persist, llmFactory } });
  if (args.port) {
    console.log(`[uso800fs] WebDAV server listening on 127.0.0.1:${args.port}`);
  }
  const serverObj: object = { ...app, port: args.port ?? 8787 };
  return serverObj;
}

// Auto-start when executed directly (bun run src/index.ts ...)
export default startFromCli();
