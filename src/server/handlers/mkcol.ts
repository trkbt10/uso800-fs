/**
 * @file MKCOL handler (pure function)
 */
import { handleMkcol as webdavMkcol } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";
import type { WebDavHooks } from "../../webdav/hooks";

/**
 * Handle MKCOL.
 */
export async function handleMkcolRequest(
  urlPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger, hooks } = options;
  logger?.logInput("MKCOL", urlPath);
  const parts = urlPath.split("/").filter(Boolean);
  const pre = await (async (h: WebDavHooks | undefined) => {
    if (!h?.beforeMkcol) { return undefined; }
    try { return await h.beforeMkcol({ urlPath, segments: parts, persist, logger }); } catch { return undefined; }
  })(hooks);
  if (pre) {
    return { response: pre };
  }
  const response = await webdavMkcol(persist, urlPath, { logger });
  await (async (h: WebDavHooks | undefined) => {
    if (!h?.afterMkcol) { return; }
    try { await h.afterMkcol({ urlPath, segments: parts, persist, logger }, response); } catch { /* ignore */ }
  })(hooks);
  return { response };
}

// createMkcolOnGenerate was removed in favor of WebDavHooks.
