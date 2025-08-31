/**
 * @file HTTP GET handler with Range support, delegating to WebDAV GET when not partial.
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { pathToSegments } from "../../llm/utils/path-utils";
import { handleGetRequest } from "../../webdav/handlers/get";

/**
 * Handle HTTP GET with Range support. Falls back to WebDAV GET for non-range or directory paths.
 */
export async function handleHttpGetRequest(urlPath: string, headers: Record<string, string> | Headers | undefined, options: HandlerOptions): Promise<HandlerResult> {
  const { persist } = options;
  const rangeHeader: string | null = (() => {
    if (headers instanceof Headers) { return headers.get("Range"); }
    if (headers) {
      const map = headers as Record<string, string>;
      return (map["Range"] ?? map["range"] ?? null) as string | null;
    }
    return null;
  })();
  const range = rangeHeader ? String(rangeHeader) : "";
  if (!range || !range.startsWith("bytes=") || urlPath.endsWith("/")) {
    return handleGetRequest(urlPath, options);
  }
  const segments = pathToSegments(urlPath);
  const exists = await persist.exists(segments);
  if (!exists) {
    return handleGetRequest(urlPath, options);
  }
  const st = await persist.stat(segments);
  if (st.type !== "file") {
    return handleGetRequest(urlPath, options);
  }
  const total = st.size ?? (await persist.readFile(segments)).length;
  const m = /bytes=(\d+)-(\d+)?/.exec(range);
  if (!m) {
    return handleGetRequest(urlPath, options);
  }
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : (total - 1);
  const clampedStart = Math.max(0, Math.min(start, total - 1));
  const clampedEnd = Math.max(clampedStart, Math.min(end, total - 1));
  const buf = await persist.readFile(segments);
  const sliced = buf.slice(clampedStart, clampedEnd + 1);
  return {
    response: {
      status: 206,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(sliced.length),
        "Content-Range": `bytes ${clampedStart}-${clampedEnd}/${total}`,
        "Accept-Ranges": "bytes",
      },
      body: sliced,
    },
  };
}
