/**
 * @file Image generation types and provider port (image domain).
 * These types are decoupled from game-specific DTOs and used across providers.
 */

export type ImageSize = { w: number; h: number };
export type ImageKind = 'thumbnail' | 'icon';
export type ImageGenerationRequest = {
  style: string;
  negative?: string;
  sizes: ImageSize[];
  seed?: number;
  /** Number of images to generate per requested size. Defaults to 1. */
  n?: number;
  /** Optional source image for edit workflows (base64). */
  sourceImage?: { mime: string; dataBase64: string };
};
export type ImageResult = { size: ImageSize; url: string; moderation: { nsfw: boolean; reason?: string }; caption?: string };
export type ImageGenJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type ImageGenJob = { id: string; repoId: string | number; kind: ImageKind; prompt: string; style: string; negative?: string; sizes: ImageSize[]; status: ImageGenJobStatus; results?: ImageResult[]; error?: string };

export type ImageGenerationProvider = {
  generate(params: {
    repoId: string | number;
    kind: ImageKind;
    prompt: string;
    request: ImageGenerationRequest;
  }): Promise<{ results: ImageResult[] }>;
};
