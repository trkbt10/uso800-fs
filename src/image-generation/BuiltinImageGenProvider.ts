/**
 * @file Built-in synthetic image generation provider (no network, no API keys).
 * Generates tiny placeholder PNGs as data URLs for requested sizes.
 */
import type { ImageGenerationProvider, ImageGenerationRequest, ImageKind, ImageResult } from "./types";

// 1x1 transparent PNG
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3+3wQAAAAASUVORK5CYII=";

function buildDataUrl(): string {
  return `data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`;
}

/**
 * Creates a built-in provider that returns tiny PNG data URLs for requested sizes.
 * Helpful for local testing where external image APIs are unavailable.
 */
export function createBuiltinImageGenProvider(): ImageGenerationProvider {
  return {
    async generate({ request }: { repoId: string | number; kind: ImageKind; prompt: string; request: ImageGenerationRequest }) {
      const results: ImageResult[] = [];
      for (const size of request.sizes) {
        results.push({ size, url: buildDataUrl(), moderation: { nsfw: false } });
      }
      return { results };
    },
  };
}
