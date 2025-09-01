/**
 * @file GET handler (pure function)
 */
import { pathToSegments } from "../../utils/path-utils";
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import type { WebDavHooks } from "../../webdav/hooks";

async function runBeforeGetHook(hooks: WebDavHooks | undefined, ctx: { urlPath: string; segments: string[]; persist: HandlerOptions["persist"]; logger?: HandlerOptions["logger"] }) {
  if (!hooks?.beforeGet) { return undefined; }
  try {
    return await hooks.beforeGet({ urlPath: ctx.urlPath, segments: ctx.segments, persist: ctx.persist, logger: ctx.logger });
  } catch {
    return undefined;
  }
}

/**
 * Handle GET with optional LLM generation for missing/empty files.
 */
export async function handleGetRequest(urlPath: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger, hooks } = options;
  const segments = pathToSegments(urlPath);

  logger?.logInput("GET", urlPath);

  // If exists, serve it; if it's an empty file and hooks are available, let hook intervene then serve
  const exists = await persist.exists(segments);
  if (exists) {
    try {
      const stat = await persist.stat(segments);
      if (stat.type === "file") {
        const isEmpty = (stat.size ?? 0) === 0;
        if (isEmpty) {
          const maybe = await runBeforeGetHook(hooks, { urlPath, segments, persist, logger });
          if (maybe) { return { response: maybe }; }
        }
        const content = await persist.readFile(segments);
        logger?.logRead(urlPath, 200, content.length);
        const etag = `W/"${String(stat.size ?? 0)}-${stat.mtime ?? ""}"`;
        const contentType = stat.mime ?? "application/octet-stream";
        return { response: { status: 200, headers: { "Content-Type": contentType, "Accept-Ranges": "bytes", "Content-Length": String(content.length), ...(stat.mtime ? { "Last-Modified": stat.mtime } : {}), ...(etag ? { ETag: etag } : {}) }, body: content } };
      }
      // Directory listing
      const children = await persist.readdir(segments);
      const bodyParts = [`<html><body><h1>Index of /${segments.join("/")}</h1><ul>`];
      for (const name of children) {
        const st = await persist.stat([...segments, name]).catch(() => null);
        const isDir = st?.type === "dir";
        bodyParts.push(`<li><a href="${encodeURIComponent(name)}${isDir ? "/" : ""}">${name}</a></li>`);
      }
      bodyParts.push("</ul></body></html>");
      const body = bodyParts.join("");
      logger?.logRead(urlPath, 200, body.length);
      return { response: { status: 200, headers: { "Content-Type": "text/html", "Accept-Ranges": "bytes" }, body } };
    } catch {
      logger?.logRead(urlPath, 500);
      return { response: { status: 500 } };
    }
  }

  // Not exists: let hook intervene, then serve or 404
  const maybe = await runBeforeGetHook(hooks, { urlPath, segments, persist, logger });
  if (maybe) {
    return { response: maybe };
  }
  // If hook created the file, serve it
  try {
    const stat = await persist.stat(segments);
    if (stat.type === "file") {
      const content = await persist.readFile(segments);
      const etag = `W/"${String(stat.size ?? 0)}-${stat.mtime ?? ""}"`;
      const contentType = stat.mime ?? "application/octet-stream";
      return { response: { status: 200, headers: { "Content-Type": contentType, "Accept-Ranges": "bytes", "Content-Length": String(content.length), ...(stat.mtime ? { "Last-Modified": stat.mtime } : {}), ...(etag ? { ETag: etag } : {}) }, body: content } };
    }
    const children = await persist.readdir(segments);
    const body = `<html><body><h1>Index of /${segments.join("/")}</h1><ul>${children.map((n) => `<li><a href="${encodeURIComponent(n)}">${n}</a></li>`).join("")}</ul></body></html>`;
    return { response: { status: 200, headers: { "Content-Type": "text/html", "Accept-Ranges": "bytes" }, body } };
  } catch {
    logger?.logRead(urlPath, 404);
    return { response: { status: 404 } };
  }
}
