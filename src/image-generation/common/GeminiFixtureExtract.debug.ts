/**
 * @file Debug runner: extract image from Gemini fixture JSON and save it.
 * - No options. Reads fixture under __fixtures__.
 * - Saves decoded PNG under var/debug and prints the path.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { extractGeminiInlineImages, toDataUrl, type GeminiResponse } from './GeminiCompat';

function isGeminiResponse(x: unknown): x is GeminiResponse {
  if (x == null || typeof x !== 'object') { return false; }
  const r = x as Record<string, unknown>;
  return Array.isArray(r['candidates']);
}

function isDataUrl(u: string): boolean {
  if (typeof u !== 'string') { return false; }
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
  if (!isDataUrl(u)) {
    throw new Error('fixture debug expects data URL');
  }
  const parsed = parseDataUrl(u);
  const buf = Buffer.from(parsed.dataBase64, 'base64');
  await fs.writeFile(filePath, buf);
}

async function main(): Promise<void> {
  const fixturePath = path.resolve(__dirname, '__fixtures__', 'gemini-inlineData-response.json');
  const txt = await fs.readFile(fixturePath, 'utf8');
  const jsonUnknown = JSON.parse(txt);
  if (!isGeminiResponse(jsonUnknown)) {
    throw new Error('fixture shape invalid');
  }
  const json = jsonUnknown;
  const itemsInline = extractGeminiInlineImages(json, 8);
  const items = itemsInline;
  if (items.length === 0) {
    throw new Error('no images found in fixture');
  }
  const url = toDataUrl(items[0].mime, items[0].data);
  const outDir = path.resolve(process.cwd(), 'var', 'debug');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'gemini-fixture-00.png');
  await saveUrlToFile(url, outPath);
  console.log(`Saved: ${outPath}`);
}

await main();
