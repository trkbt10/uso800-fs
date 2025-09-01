/**
 * @file Nano Banana (OpenAI-compatible) ImageGenerationProvider.
 * Requires explicit baseUrl/apiKey/model; no implicit environment reads.
 */
import type { ImageGenerationProvider, ImageGenerationRequest, ImageKind, ImageResult } from "./types";
import { buildGenPrompt } from "./common/OpenAICompat";
import { extractGeminiInlineImagesWithDiag, extractGeminiFileUrisDetailed, extractGeminiInlineImagesDetailed, toDataUrl, type GeminiResponse, candidateTextSummaries } from "./common/GeminiCompat";

export type NanoBananaImageGenOptions = {
  /** Base URL of the Generative Language API, e.g., https://generativelanguage.googleapis.com */
  baseUrl: string;
  /** API key for x-goog-api-key header. */
  apiKey: string;
  /** Gemini model id, e.g., gemini-2.5-flash-image-preview */
  model: string;
  /** Optional fetch implementation */
  fetchFn?: typeof fetch;
};


/**
 * Validate options for Nano Banana provider; throws when required fields are missing.
 */
function assertOpts(o: NanoBananaImageGenOptions): asserts o is NanoBananaImageGenOptions {
  if (!o || !o.baseUrl || !o.apiKey || !o.model) {
    throw new Error("NanoBananaImageGenProvider: baseUrl, apiKey, and model are required");
  }
}

/**
 * Build a full prompt by combining user text, style/negative tags, and image kind.
 */
/** Build prompt via shared helper. */
function joinPrompt(kind: ImageKind, userPrompt: string, req: ImageGenerationRequest): string {
  return buildGenPrompt(kind, userPrompt, req);
}

// Helpers extracted to common/OpenAICompat.ts

/**
 * Create an ImageGenerationProvider backed by Nano Banana's OpenAI-compatible endpoint.
 * @param options Configuration for endpoint, key, and model.
 */
export function createNanoBananaImageGenProvider(options: NanoBananaImageGenOptions): ImageGenerationProvider {
  assertOpts(options);
  const fetchImpl = options.fetchFn ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");

  async function requestOneSize(params: { prompt: string; size: { w: number; h: number }; seed?: number; n?: number; sourceImage?: { mime: string; dataBase64: string } }): Promise<Array<string | { url: string; caption?: string }>> {
    const { prompt, size, n, sourceImage } = params;
    const url = `${base}/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;
    const headers: Record<string, string> = {
      "x-goog-api-key": options.apiKey,
      "Content-Type": "application/json",
    };
    const sizeLine = `Size: ${size.w}x${size.h}`;
    const parts: Array<Record<string, unknown>> = [{ text: `${prompt}\n${sizeLine}` }];
    if (sourceImage) {
      const data = sourceImage.dataBase64;
      if (typeof data === "string") {
        if (data.length > 0) {
          parts.push({ inline_data: { mime_type: sourceImage.mime, data } });
        }
      }
    }
    const body = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        candidateCount: typeof n === "number" && n > 0 ? n : 1,
      },
    };
    const res = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await parseGeminiErrorDetail(res);
      throw new Error(`NanoBanana(Gemini) image generation failed (${res.status})${detail}`);
    }
    const json = (await res.json()) as GeminiResponse;
    const captions = candidateTextSummaries(json);
    const detailed = extractGeminiInlineImagesDetailed(json, n);
    if (detailed.length > 0) {
      return detailed.map((d) => ({ url: toDataUrl(d.item.mime, d.item.data), caption: captions[d.candidateIndex] }));
    }
    const refs = extractGeminiFileUrisDetailed(json, n);
    if (refs.length > 0) {
      const urls = await Promise.all(refs.map(async (r) => {
        const headers: Record<string, string> = {};
        try {
          const u2 = new URL(r.ref.uri);
          if (u2.hostname.includes('generativelanguage.googleapis.com')) {
            headers['x-goog-api-key'] = options.apiKey;
          }
        } catch {
          // ignore URL parse error
        }
        const rf = await fetchImpl(r.ref.uri, { headers });
        if (!rf.ok) {
          const txt = await rf.text().catch(() => '');
          throw new Error(`fetch file_uri failed (${rf.status}): ${txt}`);
        }
        const contentType = rf.headers.get('content-type') ?? r.ref.mime ?? 'image/png';
        const ab = await rf.arrayBuffer();
        const b64 = Buffer.from(ab).toString('base64');
        return { url: `data:${contentType};base64,${b64}`, caption: captions[r.candidateIndex] };
      }));
      return urls;
    }
    const { reason } = extractGeminiInlineImagesWithDiag(json, n);
    const extra = typeof reason === 'string' && reason.length > 0 ? `: ${reason}` : '';
    throw new Error(`NanoBanana(Gemini) image generation returned no image data${extra}`);
  }

  return {
    async generate({ kind, prompt, request }) {
      const fullPrompt = joinPrompt(kind, prompt, request);
      const n = typeof request.n === "number" && request.n > 0 ? request.n : 1;
      const tasks = request.sizes.map(async (s) => {
        const items = await requestOneSize({ prompt: fullPrompt, size: s, seed: request.seed, n, sourceImage: request.sourceImage });
        return items.map((it): ImageResult => {
          if (typeof it === 'string') {
            return { size: s, url: it, moderation: { nsfw: false } };
          }
          return { size: s, url: it.url, caption: it.caption, moderation: { nsfw: false } };
        });
      });
      const nested = await Promise.all(tasks);
      const results = nested.flat();
      return { results };
    },
  };
}

/** Parse Gemini error detail for message, returns empty string if unavailable. */
export async function parseGeminiErrorDetail(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } } | undefined;
    if (j !== undefined) {
      const err = j.error;
      if (err !== undefined) {
        const msg = err.message;
        if (typeof msg === 'string') {
          if (msg.length > 0) {
            return `: ${msg}`;
          }
        }
      }
    }
    return "";
  } catch {
    return "";
  }
}
