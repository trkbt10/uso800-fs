/**
 * @file Unit tests for NanoBananaImageGenProvider and its helpers (no unsafe casts).
 */
import { createNanoBananaImageGenProvider } from './NanoBananaImageGenProvider';
import { pickFirstGeminiInlineImage, toDataUrl } from './common/GeminiCompat';

function okFetch(): typeof fetch {
  return async () => {
    const body = JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'AAA' } }] } }] } );
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

describe('createNanoBananaImageGenProvider', () => {
  it('throws when required options are missing', () => {
    // @ts-expect-error missing required
    expect(() => createNanoBananaImageGenProvider({})).toThrow();
  });

  it('generates data URLs per size using Gemini-compatible response', async () => {
    const provider = createNanoBananaImageGenProvider({ baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'nb-key', model: 'gemini-2.5-flash-image-preview', fetchFn: okFetch() });
    const { results } = await provider.generate({
      repoId: 'r2',
      kind: 'thumbnail',
      prompt: 'retro game logo',
      request: { style: '8-bit', sizes: [{ w: 300, h: 150 }] },
    });
    expect(results).toHaveLength(1);
    expect(results[0].url.startsWith('data:image/png;base64,')).toBe(true);
    expect(results[0].size).toEqual({ w: 300, h: 150 });
  });

  it('supports n>1 by returning multiple results per size', async () => {
    const fetch2 = async () => new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'AAA' } }] } },
          { content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'BBB' } }] } },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    const provider = createNanoBananaImageGenProvider({ baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'nb-key', model: 'gemini-2.5-flash-image-preview', fetchFn: fetch2 });
    const { results } = await provider.generate({
      repoId: 'r2',
      kind: 'thumbnail',
      prompt: 'nano banana',
      request: { style: '8-bit', sizes: [{ w: 128, h: 128 }], n: 2 },
    });
    expect(results).toHaveLength(2);
    expect(results[0].url).toContain('data:image/png;base64,AAA');
    expect(results[1].url).toContain('data:image/png;base64,BBB');
  });

  it('uses inline_data when sourceImage is provided', async () => {
    const holder: { val: unknown } = { val: undefined };
    const fetchWithCapture: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init && typeof init.body === 'string') {
        try {
          holder.val = JSON.parse(init.body);
        } catch {
          // ignore
        }
      }
      const body = JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'AAA' } }] } }] });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const provider = createNanoBananaImageGenProvider({ baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'nb-key', model: 'gemini-2.5-flash-image-preview', fetchFn: fetchWithCapture });
    const { results } = await provider.generate({
      repoId: 'r2',
      kind: 'thumbnail',
      prompt: 'edit with image',
      request: {
        style: '8-bit',
        sizes: [{ w: 64, h: 64 }],
        sourceImage: { mime: 'image/jpeg', dataBase64: 'ZZZ' },
      },
    });
    expect(results[0].url).toContain('data:image/png;base64,AAA');
    // verify inline_data exists in request body
    const b = holder.val as { contents?: Array<{ parts?: Array<Record<string, unknown>> }> } | undefined;
    function extractParts(input: typeof b): Array<Record<string, unknown>> {
      if (!input) { return []; }
      if (!Array.isArray(input.contents)) { return []; }
      const first = input.contents[0];
      if (!first) { return []; }
      if (!Array.isArray(first.parts)) { return []; }
      return first.parts as Array<Record<string, unknown>>;
    }
    const parts = extractParts(b);
    const hasInline = parts.some((p) => Object.prototype.hasOwnProperty.call(p, 'inline_data'));
    expect(hasInline).toBe(true);
  });

  it('Gemini helpers: pickFirstGeminiInlineImage and toDataUrl work', () => {
    const item = pickFirstGeminiInlineImage({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/jpeg', data: 'QQQ' } }] } }] });
    expect(item).toEqual({ mime: 'image/jpeg', data: 'QQQ' });
    expect(toDataUrl(item!.mime, item!.data)).toBe('data:image/jpeg;base64,QQQ');
  });
});
