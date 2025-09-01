/**
 * @file OpenAI-compatible ImageGenerationProvider (e.g., model "image-gen-1").
 * No implicit env reads; all dependencies are injected via options.
 */
import type { ImageGenerationProvider, ImageResult } from "./types";
import { buildGenPrompt, extractOAErrorDetail, imageItemToUrl, type OAImagesResponse } from "./common/OpenAICompat";

export type OpenAIImageGenOptions = {
  /** Base URL like `https://api.openai.com/v1` (required). */
  baseUrl: string;
  /** API key for Authorization: Bearer (required). */
  apiKey: string;
  /** Model name, e.g., `image-gen-1` (required). */
  model: string;
  /** Optional organization header. */
  organization?: string;
  /** Optional project header. */
  project?: string;
  /** Optional fetch implementation (for Workers/tests). Defaults to global fetch. */
  fetchFn?: typeof fetch;
};


function assertOptions(o: OpenAIImageGenOptions): asserts o is OpenAIImageGenOptions {
  if (!o || !o.baseUrl || !o.apiKey || !o.model) {
    throw new Error("OpenAIImageGenProvider: baseUrl, apiKey, and model are required");
  }
}


/**
 * Create an ImageGenerationProvider using OpenAI's Images API semantics.
 * - Issues one request per requested size to allow mixed sizes.
 * - Supports either URL or base64 outputs returned by the upstream API.
 */
export function createOpenAIImageGenProvider(options: OpenAIImageGenOptions): ImageGenerationProvider {
  assertOptions(options);
  const fetchImpl = options.fetchFn ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");

  async function callOneSize(params: {
    prompt: string;
    size: { w: number; h: number };
    seed?: number;
    n?: number;
  }): Promise<string[]> {
    const { prompt, size, seed, n } = params;
    const url = `${base}/images/generations`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    };
    if (options.organization) {
      headers["OpenAI-Organization"] = options.organization;
    }
    if (options.project) {
      headers["OpenAI-Project"] = options.project;
    }

    const body: Record<string, unknown> = {
      model: options.model,
      prompt,
      size: `${size.w}x${size.h}`,
      n: typeof n === "number" && n > 0 ? n : 1,
    };
    if (typeof seed === "number") {
      body["seed"] = seed;
    }

    const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await extractOAErrorDetail(res);
      throw new Error(`OpenAI image generation failed (${res.status})${detail}`);
    }
    const json = (await res.json()) as OAImagesResponse;
    const items = Array.isArray(json.data) ? json.data : [];
    if (items.length === 0) {
      throw new Error("OpenAI image generation returned no results");
    }
    const urls = items
      .map((it) => imageItemToUrl(it))
      .filter((u): u is string => typeof u === "string");
    if (urls.length === 0) {
      throw new Error("OpenAI image generation missing url/b64_json in response items");
    }
    return urls;
  }

  return {
    async generate({ kind, prompt, request }) {
      if (request.sourceImage) {
        throw new Error("OpenAIImageGenProvider: sourceImage (edit) is not supported by this JSON endpoint");
      }
      const fullPrompt = buildGenPrompt(kind, prompt, request);
      const n = typeof request.n === "number" && request.n > 0 ? request.n : 1;
      const tasks = request.sizes.map(async (s) => {
        const urls = await callOneSize({ prompt: fullPrompt, size: s, seed: request.seed, n });
        return urls.map((url): ImageResult => ({ size: s, url, moderation: { nsfw: false } }));
      });
      const nested = await Promise.all(tasks);
      const results = nested.flat();
      return { results };
    },
  };
}
