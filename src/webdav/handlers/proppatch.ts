/**
 * @file PROPPATCH handler using DavStateStore
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { createDavStateStore } from "../dav-state";

/**
 * Handle PROPPATCH. Parses simple XML-like body and stores custom props.
 */
export async function handleProppatchRequest(urlPath: string, bodyText: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist } = options;
  const store = createDavStateStore(persist);
  const props = await store.getProps(urlPath);
  const re = /<([A-Za-z0-9_:.-]+)>([\s\S]*?)<\/\1>/g;
  for (const m of bodyText.matchAll(re)) {
    props[m[1]] = m[2];
  }
  await store.mergeProps(urlPath, props);
  const body = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">\n<D:response>\n  <D:href>${urlPath}</D:href>\n  <D:propstat>\n    <D:prop>${Object.keys(props).map((k) => `<${k}>${props[k]}</${k}>`).join("")}</D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>\n</D:response>\n</D:multistatus>`;
  return { response: { status: 207, headers: { "Content-Type": "application/xml" }, body } };
}
