/**
 * @file GET handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import {
  handleGet as webdavGet,
} from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";

async function maybeGenerateEmptyFile(
  segments: string[],
  opts: HandlerOptions
): Promise<boolean> {
  if (!opts.llm) {
    return false;
  }
  try {
    const content = await opts.llm.fabricateFileContent(segments);
    if (!content) {
      return false;
    }
    if (segments.length > 1) {
      await opts.persist.ensureDir(segments.slice(0, -1));
    }
    await opts.persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle GET with optional LLM generation for missing/empty files.
 */
export async function handleGetRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  const segments = pathToSegments(urlPath);

  logger?.logInput("GET", urlPath);

  // If exists, serve it; if it's an empty file and LLM is available, generate once then serve
  const exists = await persist.exists(segments);
  if (exists) {
    try {
      const stat = await persist.stat(segments);
      if (stat.type === "file" && (stat.size ?? 0) === 0) {
        const generated = await maybeGenerateEmptyFile(segments, options);
        const response = await webdavGet(persist, urlPath, logger);
        if (generated) {
          return { response, sideEffects: { generated: true, llmCalled: true } };
        }
        return { response };
      }
    } catch {
      // Fall through and let webdavGet decide
    }
    const response = await webdavGet(persist, urlPath, logger);
    return { response };
  }

  // Not exists: optionally generate with LLM then serve, else 404
  const generated = await maybeGenerateEmptyFile(segments, options);
  if (generated) {
    const response = await webdavGet(persist, urlPath, logger);
    return { response, sideEffects: { generated: true, llmCalled: true } };
  }

  logger?.logRead(urlPath, 404);
  return { response: { status: 404 } };
}
