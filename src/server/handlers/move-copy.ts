/**
 * @file MOVE/COPY handlers (pure functions)
 */
import { handleMove as webdavMove, handleCopy as webdavCopy } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";

/**
 * Handle MOVE.
 */
export async function handleMoveRequest(fromPath: string, destPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("MOVE", fromPath, { destination: destPath });
  const response = await webdavMove(persist, fromPath, destPath, logger);
  return { response };
}

/**
 * Handle COPY.
 */
export async function handleCopyRequest(fromPath: string, destPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("COPY", fromPath, { destination: destPath });
  const response = await webdavCopy(persist, fromPath, destPath, logger);
  return { response };
}
