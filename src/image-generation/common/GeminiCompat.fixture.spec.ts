/**
 * @file Fixture-driven tests for GeminiCompat helpers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractGeminiInlineImages, extractGeminiInlineImagesWithDiag, extractGeminiFileUris, toDataUrl, type GeminiResponse } from './GeminiCompat';

function readFixture(name: string): unknown {
  const p = path.resolve(__dirname, '__fixtures__', name);
  const txt = fs.readFileSync(p, 'utf8');
  return JSON.parse(txt);
}

function isGeminiResponse(x: unknown): x is GeminiResponse {
  if (x == null || typeof x !== 'object') { return false; }
  const r = x as Record<string, unknown>;
  const c = r['candidates'];
  return Array.isArray(c);
}

describe('GeminiCompat with real-world-like fixtures', () => {
  it('parses inlineData (camelCase) fixture and extracts image', () => {
    const json = readFixture('gemini-inlineData-response.json');
    if (!isGeminiResponse(json)) { throw new Error('fixture shape invalid'); }
    const items = extractGeminiInlineImages(json, 3);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].mime).toBe('image/png');
    expect(items[0].data.startsWith('iVBOR')).toBe(true);

    const { items: items2, reason } = extractGeminiInlineImagesWithDiag(json, 3);
    expect(items2.length).toBe(items.length);
    expect(typeof reason === 'string' ? reason.length : 0).toBeGreaterThanOrEqual(0);

    const url = toDataUrl(items[0].mime, items[0].data);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);

    const refs = extractGeminiFileUris(json, 3);
    expect(refs.length).toBe(0);
  });
});
