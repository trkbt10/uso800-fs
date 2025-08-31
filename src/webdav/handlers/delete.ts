/**
 * @file DELETE handler (pure function)
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { pathToSegments } from "../../utils/path-utils";

/**
 * Handle DELETE.
 */
export async function handleDeleteRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("DELETE", urlPath);
  const parts = pathToSegments(urlPath);
  try {
    const exists = await persist.exists(parts);
    if (!exists) {
      logger?.logDelete(urlPath, 404);
      return { response: { status: 404 } };
    }
    await persist.remove(parts, { recursive: true });
    logger?.logDelete(urlPath, 204);
    return { response: { status: 204 } };
  } catch {
    logger?.logDelete(urlPath, 500);
    return { response: { status: 500 } };
  }
}
