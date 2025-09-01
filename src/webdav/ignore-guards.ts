/**
 * @file Ignore guards for request filtering.
 */
import type { WebDAVLogger } from "../logging/webdav-logger";
import type { DavResponse } from "./handlers/types";

/**
 * Returns 404 DavResponse when the given path is ignored; else null.
 * Logs input and output consistently.
 */
export function maybeIgnored(method: string, path: string, isIgnored: (p: string) => boolean, logger: WebDAVLogger): DavResponse | null {
  logger.logInput(method, path);
  if (isIgnored(path)) {
    logger.logOutput(method, path, 404);
    return { status: 404 };
  }
  return null;
}

