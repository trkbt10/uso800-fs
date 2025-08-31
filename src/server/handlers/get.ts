/**
 * @file GET handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import {
  handleGet as webdavGet,
} from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";
import type { WebDavHooks } from "../../webdav/hooks";

async function runBeforeGetHook(hooks: WebDavHooks | undefined, ctx: { urlPath: string; segments: string[]; persist: HandlerOptions["persist"]; logger?: HandlerOptions["logger"] }) {
  if (!hooks?.beforeGet) { return undefined; }
  try {
    return await hooks.beforeGet({ urlPath: ctx.urlPath, segments: ctx.segments, persist: ctx.persist, logger: ctx.logger });
  } catch {
    return undefined;
  }
}

/**
 * Handle GET with optional LLM generation for missing/empty files.
 */
export async function handleGetRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger, hooks } = options;
  const segments = pathToSegments(urlPath);

  logger?.logInput("GET", urlPath);

  // If exists, serve it; if it's an empty file and hooks are available, let hook intervene then serve
  const exists = await persist.exists(segments);
  if (exists) {
    try {
      const stat = await persist.stat(segments);
      if (stat.type === "file") {
        const isEmpty = (stat.size ?? 0) === 0;
        if (isEmpty) {
          const maybe = await runBeforeGetHook(hooks, { urlPath, segments, persist, logger });
          const response = await webdavGet(persist, urlPath, logger);
          if (maybe) {
            return { response: maybe };
          }
          return { response };
        }
      }
    } catch {
      // Fall through and let webdavGet decide
    }
    const response = await webdavGet(persist, urlPath, logger);
    return { response };
  }

  // Not exists: let hook intervene, then serve or 404
  const maybe = await runBeforeGetHook(hooks, { urlPath, segments, persist, logger });
  if (maybe) {
    return { response: maybe };
  }
  // If hook created the file, webdavGet will return it; otherwise 404
  const response = await webdavGet(persist, urlPath, logger);
  if (response.status !== 404) {
    return { response };
  }

  logger?.logRead(urlPath, 404);
  return { response: { status: 404 } };
}
