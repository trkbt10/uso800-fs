/**
 * @file OPTIONS handler
 */
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { DavResponse } from "../../webdav/handlers/types";

/**
 * Handle OPTIONS. Emits DAV headers.
 */
export function handleOptions(logger?: WebDAVLogger): DavResponse {
  if (logger) {
    logger.logOperation({ type: "OPTIONS", path: "*", timestamp: new Date().toISOString(), status: 200 });
  }
  return {
    status: 200,
    headers: {
      DAV: "1,2",
      "MS-Author-Via": "DAV",
      Allow: "OPTIONS, PROPFIND, MKCOL, GET, HEAD, PUT, DELETE, MOVE, COPY",
    },
  };
}
