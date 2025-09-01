/**
 * @file Unit tests for OpenAIImageGenProvider and its helpers (no unsafe casts).
 */
import { createOpenAIImageGenProvider } from './OpenAIImageGenProvider';
import { extractOAErrorDetail, pickFirstImage } from './common/OpenAICompat';

function makeFetchReturningUrl(url: string): typeof fetch {
  return async () => {
    const body = JSON.stringify({ data: [{ url }] });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

function makeFetchReturningB64(b64: string): typeof fetch {
  return async () => {
    const body = JSON.stringify({ data: [{ b64_json: b64 }] });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

describe('createOpenAIImageGenProvider', () => {
  it('throws when required options are missing', async () => {
    // @ts-expect-error intentionally missing fields
    expect(() => createOpenAIImageGenProvider({})).toThrow();
  });

  it('generates URLs per requested size', async () => {
    const provider = createOpenAIImageGenProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'image-gen-1',
      fetchFn: makeFetchReturningUrl('https://cdn.example/x.png'),
    });
    const { results } = await provider.generate({
      repoId: 'r1',
      kind: 'thumbnail',
      prompt: 'castle on a hill',
      request: { style: 'pixel art', sizes: [{ w: 128, h: 128 }, { w: 256, h: 256 }] },
    });
    expect(results).toHaveLength(2);
    expect(results[0].url).toMatch('https://cdn.example/x.png');
    expect(results[0].size).toEqual({ w: 128, h: 128 });
    expect(results[1].size).toEqual({ w: 256, h: 256 });
    expect(results.every((r) => r.moderation.nsfw === false)).toBe(true);
  });

  it('supports base64 responses and maps to data URLs', async () => {
    const provider = createOpenAIImageGenProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'image-gen-1',
      fetchFn: makeFetchReturningB64('AAAABBBB'),
    });
    const { results } = await provider.generate({
      repoId: 'r1',
      kind: 'icon',
      prompt: 'banana',
      request: { style: '', sizes: [{ w: 64, h: 64 }] },
    });
    expect(results[0].url).toBe('data:image/png;base64,AAAABBBB');
  });

  it('supports n>1 by returning multiple results per size', async () => {
    const provider = createOpenAIImageGenProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'image-gen-1',
      fetchFn: async () => new Response(JSON.stringify({ data: [{ url: 'u1' }, { url: 'u2' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    });
    const { results } = await provider.generate({
      repoId: 'r1',
      kind: 'thumbnail',
      prompt: 'castle',
      request: { style: '', sizes: [{ w: 64, h: 64 }], n: 2 },
    });
    expect(results).toHaveLength(2);
    expect(results.map(r => r.url)).toEqual(['u1', 'u2']);
  });

  it('extractOAErrorDetail parses error JSON', async () => {
    const res = new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    const detail = await extractOAErrorDetail(res);
    expect(detail).toBe(': rate limited');
  });

  it('pickFirstImage returns undefined when empty', () => {
    const item = pickFirstImage({ data: [] });
    expect(item).toBeUndefined();
  });
});
