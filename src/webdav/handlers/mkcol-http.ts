/**
 * @file MKCOL HTTP wrapper for body validation
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { handleMkcolRequest } from "../../webdav/handlers/mkcol";

/**
 * Handle MKCOL over HTTP; reject requests with body (415) as per RFC, else delegate.
 */
export async function handleMkcolHttpRequest(urlPath: string, hasBody: boolean, options: HandlerOptions): Promise<HandlerResult> {
  if (hasBody) {
    return { response: { status: 415 } };
  }
  return handleMkcolRequest(urlPath, options);
}
