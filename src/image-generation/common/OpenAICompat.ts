/**
 * @file Shared helpers for OpenAI-compatible image generation endpoints.
 */
import type { ImageGenerationRequest, ImageKind } from "../types";

export type OAImageItem = { url?: string; b64_json?: string };
export type OAImagesResponse = { data: OAImageItem[] };

/** Build a full prompt from parts: user prompt, style/negative tags, and image kind. */
export function buildGenPrompt(kind: ImageKind, userPrompt: string, req: ImageGenerationRequest): string {
  const parts: string[] = [];
  parts.push(userPrompt);
  if (req.style) {
    parts.push(`Style: ${req.style}`);
  }
  if (req.negative && req.negative.trim().length > 0) {
    parts.push(`Avoid: ${req.negative}`);
  }
  parts.push(`Kind: ${kind}`);
  return parts.join("\n");
}

/** Return the first image item from an OpenAI-compatible images response. */
export function pickFirstImage(json: OAImagesResponse): OAImageItem | undefined {
  if (Array.isArray(json.data) && json.data.length > 0) {
    return json.data[0];
  }
  return undefined;
}

/** Map an image item to a usable URL. Prefers `url`, falls back to a data URL from `b64_json`. */
export function imageItemToUrl(item: OAImageItem): string | undefined {
  if (item.url && item.url.length > 0) {
    return item.url;
  }
  if (item.b64_json && item.b64_json.length > 0) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  return undefined;
}

/** Extract human-readable detail from an OpenAI-style error response. */
export async function extractOAErrorDetail(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } } | undefined;
    if (j) {
      if (j.error && j.error.message) {
        return `: ${j.error.message}`;
      }
    }
    return "";
  } catch {
    return "";
  }
}
