/**
 * @file Response helpers for converting internal DavResponse to Fetch Response.
 */
import type { DavResponse } from "./handlers/types";

/**
 * Convert DavResponse into a standard Fetch Response.
 * Ensures 204/304 have no body.
 */
export function toResponse(res: DavResponse): Response {
  const status = res.status;
  const init: ResponseInit = { status, headers: res.headers };
  const noBody = status === 204 || status === 304;
  const body = noBody ? undefined : (res.body as BodyInit | undefined);
  return new Response(body, init);
}

