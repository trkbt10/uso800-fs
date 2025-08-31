/**
 * @file MKCOL handler (pure function)
 */
import { handleMkcol as webdavMkcol } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult, LlmLike } from "./types";

/**
 * Handle MKCOL.
 */
export async function handleMkcolRequest(
  urlPath: string,
  options: HandlerOptions & { onGenerate?: (path: string[]) => void }
): Promise<HandlerResult> {
  const { persist, logger, onGenerate } = options;
  logger?.logInput("MKCOL", urlPath);
  const response = await webdavMkcol(persist, urlPath, { logger, onGenerate });
  return { response };
}

/**
 * Create onGenerate callback for MKCOL using LLM if available.
 */
export function createMkcolOnGenerate(llm?: LlmLike): ((path: string[]) => void) | undefined {
  if (!llm) {
    return undefined;
  }
  return async (folder: string[]) => {
    try {
      await llm.fabricateListing(folder);
    } catch {
      // ignore
    }
  };
}
