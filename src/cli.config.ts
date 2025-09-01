/**
 * @file Loads uso800fs.config.json from CWD and normalizes into CLI/app options.
 * No implicit env reads inside library; env resolution happens here.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import type { AppInitOptions } from "./index";
import { createOpenAIImageGenProvider } from "./image-generation/OpenAIImageGenProvider";
import { createNanoBananaImageGenProvider } from "./image-generation/NanoBananaImageGenProvider";
import type { ImageGenerationProvider } from "./image-generation/types";
import { cliConfigSchema } from "./cli.config.schema";

export type CliConfig = {
  port?: number;
  persistRoot?: string;
  ignore?: string[];
  ui?: boolean;
  llm?: { 
    apiKey?: string; 
    apiKeyEnv?: string; 
    model?: string; 
    instruction?: string;
    textInstruction?: string;
    imageInstruction?: string;
  };
  image?: {
    provider: "openai" | "nanobanana";
    openai?: {
      baseUrl?: string;
      model: string;
      apiKey?: string;
      apiKeyEnv?: string;
      organization?: string;
      project?: string;
    };
    nanobanana?: {
      baseUrl: string;
      model: string;
      apiKey?: string;
      apiKeyEnv?: string;
    };
  };
};

const ajv = new Ajv({ allErrors: true });
const validateConfig = ajv.compile(cliConfigSchema);

/**
 * Loads uso800fs.config.json from cwd (if present) and returns normalized config.
 */
export function loadConfigFile(cwd: string = process.cwd()): CliConfig | undefined {
  const p = resolve(cwd, "uso800fs.config.json");
  if (!existsSync(p)) {
    return undefined;
  }
  
  const raw = readFileSync(p, "utf8");
  const parsed: unknown = JSON.parse(raw);
  
  if (!validateConfig(parsed)) {
    const errors = validateConfig.errors?.map(e => `${e.instancePath} ${e.message}`).join(", ");
    throw new Error(`Invalid config: ${errors}`);
  }
  
  // Type is guaranteed by schema validation
  return parsed as CliConfig;
}

/**
 * Resolves port from CLI args or config.
 */
function resolvePort(cli: { port?: number }, config: CliConfig | undefined): number | undefined {
  if (typeof cli.port === "number") {
    return cli.port;
  }
  if (typeof config?.port === "number") {
    return config.port;
  }
  return undefined;
}

/**
 * Resolves persistRoot from CLI args or config.
 */
function resolvePersistRoot(cli: { persistRoot?: string }, config: CliConfig | undefined): string | undefined {
  if (typeof cli.persistRoot === "string") {
    return cli.persistRoot;
  }
  if (typeof config?.persistRoot === "string") {
    return config.persistRoot;
  }
  return undefined;
}

/**
 * Resolves ignore patterns from CLI args or config.
 */
function resolveIgnore(cli: { ignore?: string[] }, config: CliConfig | undefined): string[] | undefined {
  if (Array.isArray(cli.ignore)) {
    return cli.ignore;
  }
  if (Array.isArray(config?.ignore)) {
    return config.ignore;
  }
  return undefined;
}

/**
 * Resolves UI flag from CLI args or config.
 */
function resolveUi(cli: { ui?: boolean }, config: CliConfig | undefined): boolean | undefined {
  if (typeof cli.ui === "boolean") {
    return cli.ui;
  }
  if (typeof config?.ui === "boolean") {
    return config.ui;
  }
  return undefined;
}

/**
 * Resolves API key from config or environment variables.
 */
function resolveApiKey(config: CliConfig | undefined): string | undefined {
  if (config?.llm?.apiKey) {
    return config.llm.apiKey;
  }
  if (config?.llm?.apiKeyEnv) {
    const v = process.env[config.llm.apiKeyEnv];
    if (typeof v === "string" && v.length > 0) {
      return v;
    }
  }
  return process.env.OPENAI_API_KEY;
}

/**
 * Resolves image API key from config.
 */
function resolveImageApiKey(ok: { apiKey?: string; apiKeyEnv?: string }): string | undefined {
  if (ok.apiKey) {
    return ok.apiKey;
  }
  if (ok.apiKeyEnv) {
    const v = process.env[ok.apiKeyEnv];
    if (typeof v === "string" && v.length > 0) {
      return v;
    }
  }
  return undefined;
}

/**
 * Builds image generation provider from config.
 * Note: The actual image parameters (repoId, kind, sizes, style, negative, n) 
 * are determined dynamically at request time based on file/folder context.
 */
function buildImageProviderFromConfig(c?: CliConfig): ImageGenerationProvider | undefined {
  if (!c?.image) {
    return undefined;
  }
  
  if (c.image.provider === "openai" && c.image.openai) {
    const ok = c.image.openai;
    const resolvedKey = resolveImageApiKey(ok);
    
    if (!resolvedKey) {
      throw new Error("image.openai.apiKey (or apiKeyEnv) could not be resolved");
    }
    
    return createOpenAIImageGenProvider({
      baseUrl: ok.baseUrl ?? "https://api.openai.com/v1",
      apiKey: resolvedKey,
      model: ok.model,
      organization: ok.organization,
      project: ok.project,
    });
  }
  
  if (c.image.provider === "nanobanana" && c.image.nanobanana) {
    const nb = c.image.nanobanana;
    const resolvedKey = resolveImageApiKey(nb);
    
    if (!resolvedKey) {
      throw new Error("image.nanobanana.apiKey (or apiKeyEnv) could not be resolved");
    }
    
    return createNanoBananaImageGenProvider({
      baseUrl: nb.baseUrl,
      apiKey: resolvedKey,
      model: nb.model,
    });
  }
  
  return undefined;
}

/**
 * Merges config file and CLI args into AppInitOptions. Precedence: CLI > config > env.
 */
export function mergeConfigWithCli(
  config: CliConfig | undefined,
  cli: {
    port?: number;
    state?: string;
    model?: string;
    instruction?: string;
    persistRoot?: string;
    ignore?: string[];
    ui?: boolean;
  },
): { app: AppInitOptions; port?: number; ui?: boolean } {
  const port = resolvePort(cli, config);
  const persistRoot = resolvePersistRoot(cli, config);
  const ignore = resolveIgnore(cli, config);
  const ui = resolveUi(cli, config);

  // LLM resolution: CLI wins, then config, then env (handled here, not in library)
  const model = cli.model ?? config?.llm?.model;
  const instruction = cli.instruction ?? config?.llm?.instruction;
  const textInstruction = config?.llm?.textInstruction;
  const imageInstruction = config?.llm?.imageInstruction;
  const apiKey = resolveApiKey(config);

  const imageProvider = buildImageProviderFromConfig(config);

  /**
   * Creates image configuration with default values if provider exists.
   */
  function createImageConfig(provider: ImageGenerationProvider | undefined): AppInitOptions["image"] | undefined {
    if (!provider) {
      return undefined;
    }
    // These default values will be overridden by the LLM at runtime
    return {
      provider,
      repoId: "default",
      kind: "thumbnail" as const,
      sizes: [{ w: 512, h: 512 }],
    };
  }

  // Build the app options - image provider will be passed separately if configured
  const app: AppInitOptions = {
    apiKey,
    model,
    instruction,
    textInstruction,
    imageInstruction,
    persistRoot,
    ignore,
    image: createImageConfig(imageProvider),
  };
  
  return { app, port, ui };
}