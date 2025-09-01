/**
 * @file Shared helpers for Google Generative Language (Gemini) image generation responses.
 */

export type GeminiInlineData = { mime_type?: string; data?: string };
export type GeminiPart = {
  inline_data?: GeminiInlineData;
  inlineData?: { mimeType?: string; data?: string };
  text?: string;
  file_data?: { file_uri?: string; mime_type?: string };
  fileData?: { fileUri?: string; mimeType?: string };
} & Record<string, unknown>;
export type GeminiContent = { parts: GeminiPart[] };
export type GeminiCandidate = { content?: GeminiContent };
export type GeminiResponse = { candidates?: GeminiCandidate[] };
export type GeminiInlineImage = { mime: string; data: string };
export type GeminiFileRef = { uri: string; mime?: string };
export type GeminiExtractedImage = { item: GeminiInlineImage; candidateIndex: number };
export type GeminiExtractedFileRef = { ref: GeminiFileRef; candidateIndex: number };

/** Return the first inline image's mime and base64 data from a Gemini response. */
export function pickFirstGeminiInlineImage(json: GeminiResponse): { mime: string; data: string } | undefined {
  if (!json || !Array.isArray(json.candidates) || json.candidates.length === 0) {
    return undefined;
  }
  const cand = json.candidates[0];
  const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
  for (const p of parts) {
    if (p && p.inline_data) {
      const inline = p.inline_data;
      if (typeof inline.data === 'string') {
        if (inline.data.length > 0) {
          const mime = chooseMime(inline.mime_type);
          return { mime, data: inline.data };
        }
      }
    }
  }
  return undefined;
}

/** Build data URL from inline image fields. */
export function toDataUrl(mime: string, dataB64: string): string {
  const m = chooseMime(mime);
  return `data:${m};base64,${dataB64}`;
}

function chooseMime(m?: string): string {
  if (typeof m === 'string') {
    if (m.length > 0) {
      return m;
    }
  }
  return 'image/png';
}

/** Extract up to `limit` inline images by scanning candidates in order. */
export function extractGeminiInlineImages(json: GeminiResponse, limit?: number): GeminiInlineImage[] {
  const max = typeof limit === 'number' && limit > 0 ? limit : Number.POSITIVE_INFINITY;
  if (!json || !Array.isArray(json.candidates) || json.candidates.length === 0) {
    return [];
  }
  const out: GeminiInlineImage[] = [];
  for (const cand of json.candidates) {
    const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
    for (const p of parts) {
      const b64 = tryExtractBase64Part(p);
      if (b64) {
        out.push(b64);
        if (out.length >= max) {
          return out;
        }
      }
    }
  }
  return out;
}

/**
 * Extracts inline images with a diagnostic reason when none are found.
 */
export function extractGeminiInlineImagesWithDiag(json: GeminiResponse, limit?: number): { items: GeminiInlineImage[]; reason?: string } {
  const items = extractGeminiInlineImages(json, limit);
  if (items.length > 0) {
    return { items };
  }
  const reason = describeNoInlineImages(json);
  return { items, reason };
}

/** Extract inline images with candidate indices for caption pairing. */
export function extractGeminiInlineImagesDetailed(json: GeminiResponse, limit?: number): GeminiExtractedImage[] {
  const max = typeof limit === 'number' && limit > 0 ? limit : Number.POSITIVE_INFINITY;
  if (!json || !Array.isArray(json.candidates) || json.candidates.length === 0) { return []; }
  const out: GeminiExtractedImage[] = [];
  json.candidates.forEach((cand, idx) => {
    const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
    for (const p of parts) {
      const b64 = tryExtractBase64Part(p);
      if (b64) {
        out.push({ item: b64, candidateIndex: idx });
        if (out.length >= max) { return; }
      }
    }
  });
  return out;
}

/** Extract file URIs from parts, if present. */
export function extractGeminiFileUris(json: GeminiResponse, limit?: number): GeminiFileRef[] {
  const max = typeof limit === 'number' && limit > 0 ? limit : Number.POSITIVE_INFINITY;
  if (!json || !Array.isArray(json.candidates)) { return []; }
  const out: GeminiFileRef[] = [];
  for (const cand of json.candidates) {
    const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
    for (const p of parts) {
      const ref = tryExtractFileRef(p);
      if (ref) {
        out.push(ref);
        if (out.length >= max) { return out; }
      }
    }
  }
  return out;
}

/** Extract file URIs with candidate indices for caption pairing. */
export function extractGeminiFileUrisDetailed(json: GeminiResponse, limit?: number): GeminiExtractedFileRef[] {
  const max = typeof limit === 'number' && limit > 0 ? limit : Number.POSITIVE_INFINITY;
  if (!json || !Array.isArray(json.candidates)) { return []; }
  const out: GeminiExtractedFileRef[] = [];
  json.candidates.forEach((cand, idx) => {
    const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
    for (const p of parts) {
      const ref = tryExtractFileRef(p);
      if (ref) {
        out.push({ ref, candidateIndex: idx });
        if (out.length >= max) { return; }
      }
    }
  });
  return out;
}

/** Join all text parts per candidate into a summary string (for captions). */
export function candidateTextSummaries(json: GeminiResponse): string[] {
  if (!json || !Array.isArray(json.candidates)) { return []; }
  return json.candidates.map((cand) => {
    const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
    const texts: string[] = [];
    for (const p of parts) {
      const t = (p && typeof p.text === 'string') ? p.text : undefined;
      if (typeof t === 'string') {
        if (t.length > 0) { texts.push(t); }
      }
    }
    return texts.join(' ').trim();
  });
}

function describeNoInlineImages(json: GeminiResponse): string {
  if (!json) {
    return 'response is null';
  }
  if (!Array.isArray(json.candidates)) {
    return 'candidates not an array';
  }
  if (json.candidates.length === 0) {
    return 'no candidates';
  }
  const counts = json.candidates.map((cand) => summarizeCandidate(cand));
  const partsSummary = counts.map((c) => `${c.partCount} parts, ${c.inlineCount} inline [${c.kinds.join(',')}]`).join('; ');
  return `candidates=${String(json.candidates.length)}, ${partsSummary}`;
}

function summarizeCandidate(cand: GeminiCandidate): { partCount: number; inlineCount: number; kinds: string[] } {
  const parts: GeminiPart[] = Array.isArray(cand?.content?.parts) ? (cand!.content!.parts as GeminiPart[]) : [];
  const partCount = parts.length;
  const inlineCount = parts.filter((p) => Boolean(tryExtractBase64Part(p))).length;
  const kinds = parts.map((p) => classifyPart(p));
  return { partCount, inlineCount, kinds };
}

function classifyPart(p: GeminiPart | undefined): string {
  if (!p) { return 'unknown'; }
  if (tryExtractBase64Part(p)) { return 'inline'; }
  if (p.file_data) { return 'file'; }
  if (typeof p.text === 'string') { return 'text'; }
  return 'unknown';
}

/** Try to extract base64 image data from a part in flexible shapes. */
function tryExtractBase64Part(p: GeminiPart | undefined): GeminiInlineImage | undefined {
  if (!p) { return undefined; }
  // Standard inline_data
  if (p.inline_data && typeof p.inline_data.data === 'string') {
    if (p.inline_data.data.length > 0) {
      const mime = chooseMime(p.inline_data.mime_type);
      return { mime, data: p.inline_data.data };
    }
  }
  // CamelCase inlineData
  if (p.inlineData && typeof p.inlineData.data === 'string') {
    if (p.inlineData.data.length > 0) {
      const mime = chooseMime(p.inlineData.mimeType);
      return { mime, data: p.inlineData.data };
    }
  }
  // Some responses may put base64 directly on part.data with optional mime/mime_type
  const anyP = p as Record<string, unknown>;
  const raw = anyP['data'];
  if (typeof raw === 'string') {
    if (raw.length > 128) {
      const mime = selectMime(anyP);
      return { mime, data: raw };
    }
  }
  return undefined;
}

function tryExtractFileRef(p: GeminiPart | undefined): GeminiFileRef | undefined {
  if (!p || !p.file_data) { return undefined; }
  const uri = p.file_data.file_uri;
  if (typeof uri === 'string') {
    if (uri.length > 0) {
      return { uri, mime: typeof p.file_data.mime_type === 'string' ? p.file_data.mime_type : undefined };
    }
  }
  // CamelCase fileData
  if (p.fileData) {
    const uri2 = p.fileData.fileUri;
    if (typeof uri2 === 'string' && uri2.length > 0) {
      return { uri: uri2, mime: typeof p.fileData.mimeType === 'string' ? p.fileData.mimeType : undefined };
    }
  }
  return undefined;
}

 

function selectMime(obj: Record<string, unknown>): string {
  const mt = obj['mime_type'];
  if (typeof mt === 'string') {
    if (mt.length > 0) {
      return mt;
    }
  }
  const m = obj['mime'];
  if (typeof m === 'string') {
    if (m.length > 0) {
      return m;
    }
  }
  return 'image/png';
}
