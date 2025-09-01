/**
 * @file PROPPATCH handler using DavStateStore
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { createDavStateStore } from "../dav-state";

type PropPatch = { set: Record<string, string>; remove: string[] };

function parseProppatchXml(input: string): PropPatch {
  const result: PropPatch = { set: {}, remove: [] };
  const setBlock = /<\s*[^>]*set[^>]*>\s*<\s*[^>]*prop[^>]*>([\s\S]*?)<\s*\/\s*[^>]*prop\s*>[\s\S]*?<\s*\/\s*[^>]*set\s*>/i.exec(input);
  if (setBlock) {
    const inner = setBlock[1] ?? "";
    for (const m of inner.matchAll(/<\s*([A-Za-z0-9_:.-]+)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/g)) {
      const k = m[1];
      const v = m[2] ?? "";
      if (k) { result.set[k] = v; }
    }
  }
  const removeBlock = /<\s*[^>]*remove[^>]*>\s*<\s*[^>]*prop[^>]*>([\s\S]*?)<\s*\/\s*[^>]*prop\s*>[\s\S]*?<\s*\/\s*[^>]*remove\s*>/i.exec(input);
  if (removeBlock) {
    const inner = removeBlock[1] ?? "";
    for (const m of inner.matchAll(/<\s*([A-Za-z0-9_:.-]+)[^>]*\/>/g)) {
      const k = m[1];
      if (k) { result.remove.push(k); }
    }
    for (const m of inner.matchAll(/<\s*([A-Za-z0-9_:.-]+)\s*>[\s\S]*?<\s*\/\s*\1\s*>/g)) {
      const k = m[1];
      if (k) { result.remove.push(k); }
    }
  }
  return result;
}

/**
 * Handle PROPPATCH with minimal XML parsing for set/remove.
 */
export async function handleProppatchRequest(urlPath: string, bodyText: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist } = options;
  const store = createDavStateStore(persist);
  const current = await store.getProps(urlPath);
  const patch = parseProppatchXml(bodyText);
  const next: Record<string, string> = { ...current, ...patch.set };
  const removedExisting: string[] = [];
  const removeNotFound: string[] = [];
  if (patch.remove.length > 0) {
    for (const k of patch.remove) {
      if (k in next || k in current) {
        if (k in next) { delete next[k]; }
        removedExisting.push(k);
      } else {
        removeNotFound.push(k);
      }
    }
  }
  await store.setProps(urlPath, next);
  const okKeys = [...Object.keys(patch.set), ...removedExisting];
  const notFoundKeys = removeNotFound;
  const okBlock = (() => {
    if (okKeys.length === 0) { return ""; }
    const items = okKeys.map((k) => `      <${k}/>`).join("\n");
    return `\n  <D:propstat>\n    <D:prop>\n${items}\n    </D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>`;
  })();
  const nfBlock = (() => {
    if (notFoundKeys.length === 0) { return ""; }
    const items = notFoundKeys.map((k) => `      <${k}/>`).join("\n");
    return `\n  <D:propstat>\n    <D:prop>\n${items}\n    </D:prop>\n    <D:status>HTTP/1.1 404 Not Found</D:status>\n  </D:propstat>`;
  })();
  const body = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">\n<D:response>\n  <D:href>${urlPath}</D:href>${okBlock}${nfBlock}\n</D:response>\n</D:multistatus>`;
  return { response: { status: 207, headers: { "Content-Type": "application/xml" }, body } };
}
