/**
 * @file HTTP GET handler with Range support, delegating to WebDAV GET when not partial.
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { pathToSegments } from "../../utils/path-utils";
import { handleGetRequest } from "../../webdav/handlers/get";
import { readVersion } from "../../webdav/versioning";

/**
 * Handle HTTP GET with Range support. Falls back to WebDAV GET for non-range or directory paths.
 */
export async function handleHttpGetRequest(urlPath: string, headers: Record<string, string> | Headers | undefined, options: HandlerOptions): Promise<HandlerResult> {
  const { persist } = options;
  // Version override via header X-Version-Id
  const versionId: string | null = (() => {
    if (headers instanceof Headers) { return headers.get("X-Version-Id"); }
    if (headers) {
      const map = headers as Record<string, string>;
      return (map["X-Version-Id"] ?? map["x-version-id"] ?? null) as string | null;
    }
    return null;
  })();
  if (versionId && !urlPath.endsWith("/")) {
    const got = await readVersion(persist, urlPath, versionId);
    if (got) {
      return { response: { status: 200, headers: { "Content-Type": got.mime ?? "application/octet-stream", "Accept-Ranges": "bytes", "Content-Length": String(got.data.length) }, body: got.data } };
    }
  }
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
  const rangesText = range.replace(/^bytes=/, "");
  const parts = rangesText.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) { return handleGetRequest(urlPath, options); }
  const buf = await persist.readFile(segments);
  const etag = `W/"${String(st.size ?? 0)}-${st.mtime ?? ""}"`;
  const contentType = st.mime ?? "application/octet-stream";
  if (parts.length === 1) {
    const m = /^(\d+)-(\d+)?$/.exec(parts[0] ?? "");
    if (!m) { return handleGetRequest(urlPath, options); }
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : (total - 1);
    const clampedStart = Math.max(0, Math.min(start, total - 1));
    const clampedEnd = Math.max(clampedStart, Math.min(end, total - 1));
    const sliced = buf.slice(clampedStart, clampedEnd + 1);
    return {
      response: {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(sliced.length),
          "Content-Range": `bytes ${clampedStart}-${clampedEnd}/${total}`,
          "Accept-Ranges": "bytes",
          ...(st.mtime ? { "Last-Modified": st.mtime } : {}),
          ...(etag ? { ETag: etag } : {}),
        },
        body: sliced,
      },
    };
  }
  function clampRangeToken(token: string): { start: number; end: number } | null {
    const m = /^(\d+)-(\d+)?$/.exec(token);
    if (!m) { return null; }
    const s = Number(m[1]);
    const e = m[2] ? Number(m[2]) : (total - 1);
    const start = Math.max(0, Math.min(s, total - 1));
    const end = Math.max(start, Math.min(e, total - 1));
    return { start, end };
  }
  const tuples = parts.map(clampRangeToken).filter((x): x is { start: number; end: number } => Boolean(x));
  if (tuples.length === 0) { return handleGetRequest(urlPath, options); }
  const boundary = `boundary-${Math.random().toString(36).slice(2)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const t of tuples) {
    const header = `--${boundary}\r\nContent-Type: ${contentType}\r\nContent-Range: bytes ${t.start}-${t.end}/${total}\r\n\r\n`;
    chunks.push(encoder.encode(header));
    chunks.push(buf.slice(t.start, t.end + 1));
    chunks.push(encoder.encode("\r\n"));
  }
  chunks.push(encoder.encode(`--${boundary}--`));
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(totalLen);
  chunks.reduce((offset, c) => {
    out.set(c, offset);
    return offset + c.length;
  }, 0);
  return {
    response: {
      status: 206,
      headers: {
        "Content-Type": `multipart/byteranges; boundary=${boundary}`,
        "Content-Length": String(out.length),
        "Accept-Ranges": "bytes",
        ...(st.mtime ? { "Last-Modified": st.mtime } : {}),
        ...(etag ? { ETag: etag } : {}),
      },
      body: out,
    },
  };
}
