/**
 * @file MKCOL handler (pure function)
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import type { WebDavHooks } from "../../webdav/hooks";
import { pathToSegments } from "../../llm/utils/path-utils";

/**
 * Handle MKCOL.
 */
export async function handleMkcolRequest(
  urlPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger, hooks } = options;
  logger?.logInput("MKCOL", urlPath);
  const parts = pathToSegments(urlPath);
  if (parts.length === 0) {
    logger?.logCreate(urlPath, 403, true);
    return { response: { status: 403 } };
  }
  try {
    const already = await persist.exists(parts);
    if (already) {
      logger?.logCreate(urlPath, 405, true);
      return { response: { status: 405 } };
    }
    if (parts.length > 1) {
      const parentExists = await persist.exists(parts.slice(0, -1));
      if (!parentExists) {
        logger?.logCreate(urlPath, 409, true);
        return { response: { status: 409 } };
      }
    }
  } catch {
    // fallthrough
  }
  const pre = await (async (h: WebDavHooks | undefined) => {
    if (!h?.beforeMkcol) { return undefined; }
    try { return await h.beforeMkcol({ urlPath, segments: parts, persist, logger }); } catch { return undefined; }
  })(hooks);
  if (pre) {
    return { response: pre };
  }
  await persist.ensureDir(parts);
  const response = { status: 201 } as const;
  await (async (h: WebDavHooks | undefined) => {
    if (!h?.afterMkcol) { return; }
    try { await h.afterMkcol({ urlPath, segments: parts, persist, logger }, response); } catch { /* ignore */ }
  })(hooks);
  return { response };
}

// createMkcolOnGenerate was removed in favor of WebDavHooks.
