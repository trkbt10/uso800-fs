/**
 * @file DELETE handler (pure function)
 */
import { handleDelete as webdavDelete } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";

/**
 * Handle DELETE.
 */
export async function handleDeleteRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("DELETE", urlPath);
  const response = await webdavDelete(persist, urlPath, logger);
  return { response };
}
