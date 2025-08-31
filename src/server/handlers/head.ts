/**
 * @file HEAD handler (pure function)
 */
import { handleHead as webdavHead } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";

/**
 * Handle HEAD.
 */
export async function handleHeadRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("HEAD", urlPath);
  const response = await webdavHead(persist, urlPath, logger);
  return { response };
}
