/**
 * @file Simple debug runner for OpenAI image-gen-1 provider.
 * Reads API key from OPENAI_API_KEY (required). Generates a 512x512 image and saves it under var/debug.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createOpenAIImageGenProvider } from './OpenAIImageGenProvider';

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
  const apiKey = requireEnv('OPENAI_API_KEY');
  const provider = createOpenAIImageGenProvider({
    baseUrl: 'https://api.openai.com/v1',
    apiKey,
    model: 'image-gen-1',
  });
  const { results } = await provider.generate({
    repoId: 'debug',
    kind: 'thumbnail',
    prompt: 'Game store thumbnail for a cozy farming sim called "Nano Banana Orchard" — sunrise lighting, cute vibrant palette, tiny banana trees and a smiling farmer character; no UI text; high contrast focal point; readable at small size',
    request: { style: 'painterly, cozy, Ghibli-inspired', sizes: [{ w: 512, h: 512 }] },
  });
  const outDir = path.resolve(process.cwd(), 'var', 'debug');
  await fs.mkdir(outDir, { recursive: true });
  const tasks = results.map(async (r, i) => {
    const filePath = path.join(outDir, `openai-image-${String(i).padStart(2, '0')}.png`);
    await saveUrlToFile(r.url, filePath);
    return filePath;
  });
  const files = await Promise.all(tasks);
  for (const f of files) {
    console.log(`Saved: ${f}`);
  }
}

await main();
