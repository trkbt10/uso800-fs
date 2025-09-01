/**
 * @file FS action executors extracted from orchestrator for testability.
 */
import type { PersistAdapter } from "../../webdav/persist/types";
import type { ImageGenerationProvider, ImageGenerationRequest, ImageKind, ImageSize } from "../../image-generation/types";
import { dataUrlToBytes, convertToTargetExt } from "../../image-generation/transcode";

export type ImageExecConfig = {
  provider: ImageGenerationProvider;
  repoId: string | number;
  kind: ImageKind;
  request: Omit<ImageGenerationRequest, "sizes"> & { sizes: ImageSize[] };
};

export type FsExecDeps = { persist: PersistAdapter; image?: ImageExecConfig };

export type ListingStats = { dirs: number; files: number; bytes: number; dirNames: string[]; fileNames: string[] };
export type FileStats = { files: number; bytes: number; fileName?: string };

function isImageMime(m: string | undefined): boolean {
  if (typeof m !== "string") { return false; }
  return m.startsWith("image/");
}

async function generateOneImage(cfg: ImageExecConfig, prompt: string) {
  const { provider, repoId, kind, request } = cfg;
  const firstSize = request.sizes[0];
  if (!firstSize) { throw new Error("image request requires at least one size"); }
  const { results } = await provider.generate({ repoId, kind, prompt, request: { ...request, sizes: [firstSize] } });
  if (!Array.isArray(results) || results.length === 0) { throw new Error("image provider returned no results"); }
  return results[0];
}

/**
 * Writes either a text or an image file based on mime. Returns bytes written.
 */
export async function writeGeneratedFile(deps: FsExecDeps, path: string[], content: string, mime: string): Promise<number> {
  if (isImageMime(mime)) {
    if (!deps.image) { throw new Error("Image mime requested but no image provider configured"); }
    const generated = await generateOneImage(deps.image, content);
    const src = dataUrlToBytes(generated.url);
    const targetName = path[path.length - 1] ?? "image.png";
    const target = await convertToTargetExt(src, targetName);
    await deps.persist.writeFile(path, target.bytes, target.mime);
    return target.bytes.length;
  }
  const data = new TextEncoder().encode(content);
  await deps.persist.writeFile(path, data, mime);
  return data.length;
}

/**
 * Process listing entries: creates folders or writes files. Mutates stats.
 */
export async function processFsListing(
  deps: FsExecDeps,
  stats: ListingStats,
  folder: string[],
  entries: Array<{ kind: "dir" | "file"; name: string; content: string; mime: string }>,
): Promise<void> {
  await deps.persist.ensureDir(folder);
  for (const e of entries) {
    if (e.kind === "dir") {
      await deps.persist.ensureDir([...folder, e.name]);
      stats.dirs += 1;
      stats.dirNames.push(e.name);
      continue;
    }
    const path = [...folder, e.name];
    const written = await writeGeneratedFile(deps, path, e.content, e.mime);
    stats.files += 1;
    stats.bytes += written;
    stats.fileNames.push(e.name);
  }
}

/**
 * Process file creation and update stats. Returns response body text (empty for images).
 */
export async function processEmitFile(
  deps: FsExecDeps,
  stats: FileStats,
  path: string[],
  content: string,
  mime: string,
): Promise<string> {
  await deps.persist.ensureDir(path.slice(0, -1));
  const written = await writeGeneratedFile(deps, path, content, mime);
  stats.files += 1;
  stats.bytes += written;
  stats.fileName = path[path.length - 1];
  if (isImageMime(mime)) {
    return "";
  }
  return content;
}

