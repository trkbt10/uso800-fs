/**
 * @file PROPFIND handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import { handlePropfind as webdavPropfind } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";
import type { WebDavHooks } from "../../webdav/hooks";

async function runBeforePropfindHook(hooks: WebDavHooks | undefined, ctx: { urlPath: string; segments: string[]; depth: string | null; persist: HandlerOptions["persist"]; logger?: HandlerOptions["logger"] }) {
  if (!hooks?.beforePropfind) { return undefined; }
  try {
    return await hooks.beforePropfind({ urlPath: ctx.urlPath, segments: ctx.segments, depth: ctx.depth, persist: ctx.persist, logger: ctx.logger });
  } catch {
    return undefined;
  }
}

/**
 * Handle PROPFIND; if target is missing or an empty directory and LLM is available, generate listing once.
 */
export async function handlePropfindRequest(
  urlPath: string,
  depth: string | null | undefined,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger, hooks, shouldIgnore } = options;
  const segments = pathToSegments(urlPath);
  const normalizedDepth: string | null = depth ?? null;

  logger?.logInput("PROPFIND", urlPath, { depth: normalizedDepth });

  const exists = await persist.exists(segments);
  if (!exists) {
    const maybe = await runBeforePropfindHook(hooks, { urlPath, segments, depth: normalizedDepth, persist, logger });
    if (maybe) {
      return { response: maybe };
    }
    // proceed to list (hook may have created it), else 404
    const response = await webdavPropfind(
      persist,
      urlPath,
      normalizedDepth,
      logger,
      shouldIgnore ? { shouldIgnore } : undefined
    );
    if (response.status === 404) {
      logger?.logList(urlPath, 404);
      return { response };
    }
    return { response };
  }

  // Exists: if empty directory and LLM present, generate once
  try {
    const st = await persist.stat(segments);
    if (st.type === "dir") {
      const names = await persist.readdir(segments);
      if (names.length === 0) {
        await runBeforePropfindHook(hooks, { urlPath, segments, depth: normalizedDepth, persist, logger });
        const response = await webdavPropfind(
          persist,
          urlPath,
          normalizedDepth,
          logger,
          shouldIgnore ? { shouldIgnore } : undefined
        );
        return { response };
      }
    }
  } catch {
    // Fall through to normal PROPFIND
  }

  const response = await webdavPropfind(
    persist,
    urlPath,
    normalizedDepth,
    logger,
    shouldIgnore ? { shouldIgnore } : undefined
  );
  return { response };
}
