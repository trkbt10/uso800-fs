/**
 * @file Simple debug runner for NanoBanana (Gemini) image generation.
 * Reads API key from GEMINI_API_KEY (required). Generates a 512x512 image and saves it under var/debug.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createNanoBananaImageGenProvider } from './NanoBananaImageGenProvider';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return v;
}

function isDataUrl(u: string): boolean {
  if (typeof u !== 'string') {
    return false;
  }
  return u.startsWith('data:');
}

function parseDataUrl(u: string): { mime: string; dataBase64: string } {
  const idx = u.indexOf(',');
  if (idx < 0) {
    throw new Error('invalid data url');
  }
  const header = u.slice(0, idx);
  const payload = u.slice(idx + 1);
  const mime = header.startsWith('data:') ? header.substring(5, header.indexOf(';')) : 'application/octet-stream';
  return { mime, dataBase64: payload };
}

async function saveUrlToFile(u: string, filePath: string): Promise<void> {
  if (isDataUrl(u)) {
    const parsed = parseDataUrl(u);
    const buf = Buffer.from(parsed.dataBase64, 'base64');
    await fs.writeFile(filePath, buf);
    return;
  }
  const res = await fetch(u);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const ab = await res.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(ab));
}

async function main(): Promise<void> {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const provider = createNanoBananaImageGenProvider({
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey,
    model: 'gemini-2.5-flash-image-preview',
  });
  const prompt = 'Mobile game app icon for a sci‑fi puzzle called "Nano Banana Labs" — stylized banana with atom ring motif, glossy lighting, bold silhouette, minimal background, no letters or numbers, high legibility at 128px';
  const request = { style: 'flat vector, glossy, neon accents', sizes: [{ w: 512, h: 512 }] };
  const outDir = path.resolve(process.cwd(), 'var', 'debug');
  await fs.mkdir(outDir, { recursive: true });

  try {
    const { results } = await provider.generate({
      repoId: 'debug',
      kind: 'thumbnail',
      prompt,
      request,
    });
    const tasks = results.map(async (r, i) => {
      const filePath = path.join(outDir, `gemini-image-${String(i).padStart(2, '0')}.png`);
      await saveUrlToFile(r.url, filePath);
      return filePath;
    });
    const files = await Promise.all(tasks);
    for (const f of files) {
      console.log(`Saved: ${f}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Generation error: ${msg}`);
    // Fetch raw response for diagnostics and save JSON
    const raw = await debugFetchGeminiJson({
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey,
      model: 'gemini-2.5-flash-image-preview',
      prompt,
      size: { w: 512, h: 512 },
    });
    const jsonPath = path.join(outDir, 'gemini-response.json');
    await fs.writeFile(jsonPath, JSON.stringify(raw, null, 2), 'utf8');
    console.error(`Wrote raw response: ${jsonPath}`);
    const summary = summarizeGemini(raw);
    console.error(`Summary: ${summary}`);
    throw err;
  }
}

await main();

type DebugArgs = { baseUrl: string; apiKey: string; model: string; prompt: string; size: { w: number; h: number } };
async function debugFetchGeminiJson(a: DebugArgs): Promise<unknown> {
  const url = `${a.baseUrl.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(a.model)}:generateContent`;
  const headers: Record<string, string> = { 'x-goog-api-key': a.apiKey, 'Content-Type': 'application/json' };
  const body = {
    contents: [
      { parts: [{ text: `${a.prompt}\nSize: ${a.size.w}x${a.size.h}` }] },
    ],
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, text };
  }
}

function summarizeGemini(json: unknown): string {
  if (json == null || typeof json !== 'object') { return 'no response'; }
  const root = json as Record<string, unknown>;
  const cand = root['candidates'];
  if (!Array.isArray(cand)) { return 'no candidates field'; }
  const partsSummaries: string[] = [];
  for (const c of cand) {
    const parts = extractPartsUnknown(c);
    const kinds = parts.map((p) => classifyKind(p));
    partsSummaries.push(`${parts.length} parts [${kinds.join(',')}]`);
  }
  return `candidates=${cand.length}; ${partsSummaries.join('; ')}`;
}

function classifyKind(p: unknown): string {
  if (p == null || typeof p !== 'object') { return 'unknown'; }
  const obj = p as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, 'inline_data') || Object.prototype.hasOwnProperty.call(obj, 'inlineData')) { return 'inline'; }
  if (Object.prototype.hasOwnProperty.call(obj, 'file_data') || Object.prototype.hasOwnProperty.call(obj, 'fileData')) { return 'file'; }
  const t = obj['text'];
  if (typeof t === 'string') { return 'text'; }
  return 'unknown';
}

function extractPartsUnknown(c: unknown): unknown[] {
  if (c == null || typeof c !== 'object') { return []; }
  const content = (c as Record<string, unknown>)['content'];
  if (content == null || typeof content !== 'object') { return []; }
  const maybeParts = (content as Record<string, unknown>)['parts'];
  if (!Array.isArray(maybeParts)) { return []; }
  return maybeParts as unknown[];
}
