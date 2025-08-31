/**
 * @file PROPFIND handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import type { WebDavHooks } from "../../webdav/hooks";

async function runBeforePropfindHook(hooks: WebDavHooks | undefined, ctx: { urlPath: string; segments: string[]; depth: string | null; persist: HandlerOptions["persist"]; logger?: HandlerOptions["logger"] }) {
  if (!hooks?.beforePropfind) { return undefined; }
  try {
    return await hooks.beforePropfind({ urlPath: ctx.urlPath, segments: ctx.segments, depth: ctx.depth, persist: ctx.persist, logger: ctx.logger });
  } catch {
    return undefined;
  }
}

/**
 * Handle PROPFIND; if target is missing or an empty directory and LLM is available, generate listing once.
 */
export async function handlePropfindRequest(
  urlPath: string,
  depth: string | null | undefined,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger, hooks, shouldIgnore } = options;
  const segments = pathToSegments(urlPath);
  const normalizedDepth: string | null = depth ?? null;

  logger?.logInput("PROPFIND", urlPath, { depth: normalizedDepth });

  const exists = await persist.exists(segments);
  if (!exists) {
    const maybe = await runBeforePropfindHook(hooks, { urlPath, segments, depth: normalizedDepth, persist, logger });
    if (maybe) { return { response: maybe }; }
    // proceed to list (hook may have created it), else 404
    const res = await buildPropfindResponse(persist, urlPath, segments, normalizedDepth, logger, shouldIgnore);
    return { response: res };
  }

  // Exists: if empty directory and LLM present, generate once
  try {
    const st = await persist.stat(segments);
    if (st.type === "dir") {
      const names = await persist.readdir(segments);
      if (names.length === 0) {
        await runBeforePropfindHook(hooks, { urlPath, segments, depth: normalizedDepth, persist, logger });
        const res = await buildPropfindResponse(persist, urlPath, segments, normalizedDepth, logger, shouldIgnore);
        return { response: res };
      }
    }
  } catch {
    // Fall through to normal PROPFIND
  }

  const response = await buildPropfindResponse(persist, urlPath, segments, normalizedDepth, logger, shouldIgnore);
  return { response };
}

import type { PersistAdapter, Stat } from "../../persist/types";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { DavResponse } from "../../webdav/handlers/types";

async function statOrNull(persist: PersistAdapter, path: string[]): Promise<Stat | null> {
  try { return await persist.stat(path); } catch { return null; }
}

async function buildPropfindResponse(
  persist: PersistAdapter,
  urlPath: string,
  parts: string[],
  depth: string | null,
  logger?: WebDAVLogger,
  shouldIgnore?: (fullPath: string, baseName: string) => boolean,
): Promise<DavResponse> {
  const exists = await persist.exists(parts);
  if (!exists) {
    logger?.logList(urlPath, 404);
    return { status: 404 };
  }
  const stat = await persist.stat(parts);
  const isDir = stat.type === "dir";
  const selfHref = urlPath.endsWith("/") ? urlPath : urlPath + "/";
  const entryParts: string[] = [];
  const header = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">`;
  const selfEntry = `\n<D:response>\n  <D:href>${selfHref}</D:href>\n  <D:propstat>\n    <D:prop>\n      <D:displayname>${parts[parts.length - 1] ?? "/"}</D:displayname>\n      <D:getcontentlength>${stat.size ?? 0}</D:getcontentlength>\n      <D:resourcetype>${isDir ? "<D:collection/>" : ""}</D:resourcetype>\n    </D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>\n</D:response>`;
  function pushEntry(parentHref: string, name: string, st: Stat) {
    const childIsDir = st.type === "dir";
    entryParts.push(`\n<D:response>\n  <D:href>${parentHref}${encodeURIComponent(name)}${childIsDir ? "/" : ""}</D:href>\n  <D:propstat>\n    <D:prop>\n      <D:displayname>${name}</D:displayname>\n      <D:getcontentlength>${st.size ?? 0}</D:getcontentlength>\n      <D:resourcetype>${childIsDir ? "<D:collection/>" : ""}</D:resourcetype>\n    </D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>\n</D:response>`);
  }
  if (depth !== "0" && isDir) {
    const baseHref = selfHref;
    const names = await persist.readdir(parts);
    const filtered = shouldIgnore ? names.filter((n) => !shouldIgnore(`${baseHref}${n}`, n)) : names;
    const stats = await Promise.all(filtered.map(async (n) => ({ name: n, st: await statOrNull(persist, [...parts, n]) })));
    for (const { name, st } of stats) {
      if (!st) { continue; }
      pushEntry(baseHref, name, st);
    }
    if (String(depth).toLowerCase() === "infinity") {
      const queue = stats.filter((x) => x.st?.type === "dir").map((x) => ({ parts: [...parts, x.name], href: `${baseHref}${encodeURIComponent(x.name)}/` }));
      while (queue.length > 0) {
        const node = queue.shift()!;
        const child = await persist.readdir(node.parts);
        const childFiltered = shouldIgnore ? child.filter((n) => !shouldIgnore(`${node.href}${n}`, n)) : child;
        const childStats = await Promise.all(childFiltered.map(async (n) => ({ name: n, st: await statOrNull(persist, [...node.parts, n]) })));
        for (const { name, st } of childStats) {
          if (!st) { continue; }
          pushEntry(node.href, name, st);
          if (st.type === "dir") {
            queue.push({ parts: [...node.parts, name], href: `${node.href}${encodeURIComponent(name)}/` });
          }
        }
      }
    }
  }
  const footer = "</D:multistatus>";
  const count = entryParts.length;
  logger?.logList(urlPath, 207, count);
  return { status: 207, headers: { "Content-Type": "application/xml" }, body: [header, selfEntry, ...entryParts, footer].join("") };
}
