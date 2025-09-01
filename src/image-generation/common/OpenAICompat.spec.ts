/**
 * @file Unit tests for OpenAI-compatible common helpers.
 */
import { buildGenPrompt, extractOAErrorDetail, imageItemToUrl, pickFirstImage } from './OpenAICompat';

describe('OpenAICompat helpers', () => {
  it('buildGenPrompt concatenates fields', () => {
    const out = buildGenPrompt('thumbnail', 'castle', { style: 'pixel', sizes: [{ w: 1, h: 1 }] });
    expect(out).toContain('castle');
    expect(out).toContain('Style: pixel');
    expect(out).toContain('Kind: thumbnail');
  });

  it('pickFirstImage returns first item', () => {
    const item = pickFirstImage({ data: [{ url: 'u1' }, { url: 'u2' }] });
    expect(item?.url).toBe('u1');
  });

  it('imageItemToUrl prefers url then b64', () => {
    expect(imageItemToUrl({ url: 'x' })).toBe('x');
    expect(imageItemToUrl({ b64_json: 'AAA' })).toBe('data:image/png;base64,AAA');
    expect(imageItemToUrl({})).toBeUndefined();
  });

  it('extractOAErrorDetail parses message', async () => {
    const res = new Response(JSON.stringify({ error: { message: 'oops' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const detail = await extractOAErrorDetail(res);
    expect(detail).toBe(': oops');
  });
});
