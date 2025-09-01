/**
 * @file Debug runner: extract image(s) from the last saved Gemini JSON (var/debug/gemini-response.json) and save PNGs.
 * - If inline data is present, decodes and saves it.
 * - If only file URIs are present, fetches them; for generativelanguage.googleapis.com, GEMINI_API_KEY is required.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { extractGeminiInlineImages, extractGeminiFileUris, type GeminiResponse } from './GeminiCompat';

function isGeminiResponse(x: unknown): x is GeminiResponse {
  if (x == null || typeof x !== 'object') { return false; }
  const r = x as Record<string, unknown>;
  return Array.isArray(r['candidates']);
}

// no requireEnv usage here; optional API key is read directly when needed

function parseDataUrl(u: string): { mime: string; dataBase64: string } {
  const idx = u.indexOf(',');
  if (idx < 0) { throw new Error('invalid data url'); }
  const header = u.slice(0, idx);
  const payload = u.slice(idx + 1);
  const mime = header.startsWith('data:') ? header.substring(5, header.indexOf(';')) : 'application/octet-stream';
  return { mime, dataBase64: payload };
}

async function saveDataUrlToPng(u: string, filePath: string): Promise<void> {
  const { dataBase64 } = parseDataUrl(u);
  const buf = Buffer.from(dataBase64, 'base64');
  await fs.writeFile(filePath, buf);
}

async function fetchFileUriAsDataUrl(uri: string, apiKey: string | undefined): Promise<string> {
  const headers: Record<string, string> = {};
  try {
    const u = new URL(uri);
    if (u.hostname.includes('generativelanguage.googleapis.com')) {
      if (!apiKey) { throw new Error('GEMINI_API_KEY is required to fetch Google-hosted file_uri'); }
      headers['x-goog-api-key'] = apiKey;
    }
  } catch {
    // ignore parse error
  }
  const res = await fetch(uri, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`fetch file_uri failed (${res.status}): ${txt}`);
  }
  const ct = res.headers.get('content-type') ?? 'image/png';
  const ab = await res.arrayBuffer();
  const b64 = Buffer.from(ab).toString('base64');
  return `data:${ct};base64,${b64}`;
}

async function main(): Promise<void> {
  const inPath = path.resolve(process.cwd(), 'var', 'debug', 'gemini-response.json');
  const text = await fs.readFile(inPath, 'utf8');
  const jsonUnknown = JSON.parse(text);
  if (!isGeminiResponse(jsonUnknown)) { throw new Error('response JSON shape invalid'); }
  const json = jsonUnknown;

  const outDir = path.resolve(process.cwd(), 'var', 'debug');
  await fs.mkdir(outDir, { recursive: true });

  const inline = extractGeminiInlineImages(json, 8);
  if (inline.length > 0) {
    const tasks = inline.map(async (it, i) => {
      const url = `data:${it.mime};base64,${it.data}`;
      const p = path.join(outDir, `gemini-saved-${String(i).padStart(2, '0')}.png`);
      await saveDataUrlToPng(url, p);
      return p;
    });
    const files = await Promise.all(tasks);
    for (const f of files) { console.log(`Saved: ${f}`); }
    return;
  }

  const refs = extractGeminiFileUris(json, 8);
  if (refs.length > 0) {
    const apiKey = process.env['GEMINI_API_KEY'];
    const tasks = refs.map(async (r, i) => {
      const url = await fetchFileUriAsDataUrl(r.uri, apiKey);
      const p = path.join(outDir, `gemini-saved-${String(i).padStart(2, '0')}.png`);
      await saveDataUrlToPng(url, p);
      return p;
    });
    const files = await Promise.all(tasks);
    for (const f of files) { console.log(`Saved: ${f}`); }
    return;
  }

  throw new Error('No inline images or file URIs found in saved response');
}

await main();
