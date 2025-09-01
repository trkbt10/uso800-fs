/**
 * @file Image transcode helpers (PNG→target ext) and data URL decoding.
 * Keep image processing knowledge outside the LLM orchestrator.
 */
import { createRequire } from "node:module";

/**
 * Decodes a data URL of the form `data:<mime>;base64,<data>` into raw bytes.
 * If the input is not a base64 data URL, returns an empty byte array.
 */
export function dataUrlToBytes(url: string): Uint8Array {
  const m = /^data:([^;,]+)?;base64,(.*)$/i.exec(url);
  if (!m) { return new Uint8Array(); }
  const b64 = m[2];
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf);
}

function extensionOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i <= 0) { return null; }
  const ext = name.slice(i + 1);
  if (ext.length === 0) { return null; }
  return ext.toLowerCase();
}

function mimeForExt(ext: string): string {
  if (ext === "jpg" || ext === "jpeg") { return "image/jpeg"; }
  if (ext === "webp") { return "image/webp"; }
  if (ext === "avif") { return "image/avif"; }
  return "image/png";
}

type SharpPipeline = {
  png: (opts?: Record<string, unknown>) => SharpPipeline;
  jpeg: (opts?: Record<string, unknown>) => SharpPipeline;
  webp: (opts?: Record<string, unknown>) => SharpPipeline;
  avif: (opts?: Record<string, unknown>) => SharpPipeline;
  toBuffer: () => Promise<Buffer>;
};
type SharpModule = (input: Uint8Array) => SharpPipeline;

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getSharpExport(mod: unknown): SharpModule | null {
  if (typeof mod === "function") {
    return mod as SharpModule;
  }
  if (isObject(mod)) {
    const def = (mod as Record<string, unknown>).default;
    if (typeof def === "function") {
      return def as SharpModule;
    }
  }
  return null;
}

function isSharpPipeline(x: unknown): x is SharpPipeline {
  if (!isObject(x)) { return false; }
  const r = x as Record<string, unknown>;
  return typeof r.toBuffer === "function" && typeof r.png === "function" && typeof r.jpeg === "function" && typeof r.webp === "function" && typeof r.avif === "function";
}

async function sharpTranscode(src: Uint8Array, targetExt: string): Promise<Uint8Array> {
  const req = createRequire(import.meta.url);
  const mod = req("sharp");
  const sharpFn = getSharpExport(mod);
  if (!sharpFn) {
    throw new Error("Image transcode requires 'sharp' default export or function");
  }
  const pip = sharpFn(src);
  if (!isSharpPipeline(pip)) {
    throw new Error("Invalid sharp pipeline interface");
  }
  if (targetExt === "jpg" || targetExt === "jpeg") {
    pip.jpeg({});
  } else if (targetExt === "webp") {
    pip.webp({});
  } else if (targetExt === "avif") {
    pip.avif({});
  } else {
    pip.png({});
  }
  const buf = await pip.toBuffer();
  return new Uint8Array(buf);
}

/**
 * Convert source PNG (or generally decodable image) bytes to target ext.
 * Unsupported ext falls back to PNG as-is.
 */
export async function convertToTargetExt(srcPng: Uint8Array, fileName: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const ext = extensionOf(fileName);
  if (!ext || ext === "png") {
    return { bytes: srcPng, mime: "image/png" };
  }
  const supported = new Set(["jpg", "jpeg", "webp", "avif"]);
  if (!supported.has(ext)) {
    return { bytes: srcPng, mime: "image/png" };
  }
  const out = await sharpTranscode(srcPng, ext);
  return { bytes: out, mime: mimeForExt(ext) };
}
