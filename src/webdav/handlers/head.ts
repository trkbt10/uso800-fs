/**
 * @file HEAD handler (pure function)
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { pathToSegments } from "../../utils/path-utils";
import { mapErrorToDav } from "../errors";

/**
 * Handle HEAD.
 */
export async function handleHeadRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("HEAD", urlPath);
  const parts = pathToSegments(urlPath);
  try {
    const exists = await persist.exists(parts);
    if (!exists) {
      return { response: { status: 404 } };
    }
    const stat = await persist.stat(parts);
    if (stat.type === "dir") {
      return { response: { status: 200, headers: { "Content-Type": "text/html", "Accept-Ranges": "bytes" } } };
    }
    const etag = `W/"${String(stat.size ?? 0)}-${stat.mtime ?? ""}"`;
    const contentType = stat.mime ?? "application/octet-stream";
    return { response: { status: 200, headers: { "Content-Type": contentType, "Content-Length": String(stat.size ?? 0), "Accept-Ranges": "bytes", ...(stat.mtime ? { "Last-Modified": stat.mtime } : {}), ...(etag ? { ETag: etag } : {}) } } };
  } catch (err) {
    const mapped = mapErrorToDav(err);
    return { response: { status: mapped.status } };
  }
}
