/**
 * @file PROPFIND handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import { handlePropfind as webdavPropfind } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";

async function maybeGenerateListing(
  segments: string[],
  depth: string | null,
  opts: HandlerOptions
): Promise<boolean> {
  if (!opts.llm) {
    return false;
  }
  try {
    await opts.llm.fabricateListing(segments, { depth });
    return true;
  } catch {
    return false;
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
  const { persist, logger, shouldIgnore } = options;
  const segments = pathToSegments(urlPath);
  const normalizedDepth: string | null = depth ?? null;

  logger?.logInput("PROPFIND", urlPath, { depth: normalizedDepth });

  const exists = await persist.exists(segments);
  if (!exists) {
    const generated = await maybeGenerateListing(segments, normalizedDepth, options);
    if (!generated) {
      logger?.logList(urlPath, 404);
      return { response: { status: 404 } };
    }
    const response = await webdavPropfind(
      persist,
      urlPath,
      normalizedDepth,
      logger,
      shouldIgnore ? { shouldIgnore } : undefined
    );
    return { response, sideEffects: { generated: true, llmCalled: true } };
  }

  // Exists: if empty directory and LLM present, generate once
  try {
    const st = await persist.stat(segments);
    if (st.type === "dir") {
      const names = await persist.readdir(segments);
      if (names.length === 0) {
        const generated = await maybeGenerateListing(segments, normalizedDepth, options);
        const response = await webdavPropfind(
          persist,
          urlPath,
          normalizedDepth,
          logger,
          shouldIgnore ? { shouldIgnore } : undefined
        );
        if (generated) {
          return { response, sideEffects: { generated: true, llmCalled: true } };
        }
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
