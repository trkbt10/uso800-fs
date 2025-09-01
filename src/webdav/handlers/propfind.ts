/**
 * @file PROPFIND handler (pure function)
 */
import { pathToSegments } from "../../utils/path-utils";
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
  options: HandlerOptions,
  bodyText?: string | null,
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
    const res = await buildPropfindResponse(createDataLoaderAdapter(persist), urlPath, segments, normalizedDepth, logger, shouldIgnore, bodyText ?? undefined);
    return { response: res };
  }

  // Exists: if empty directory and LLM present, generate once
  try {
    const st = await persist.stat(segments);
    if (st.type === "dir") {
      const names = await persist.readdir(segments);
      if (names.length === 0) {
        await runBeforePropfindHook(hooks, { urlPath, segments, depth: normalizedDepth, persist, logger });
        const res = await buildPropfindResponse(createDataLoaderAdapter(persist), urlPath, segments, normalizedDepth, logger, shouldIgnore, bodyText ?? undefined);
        return { response: res };
      }
    }
  } catch {
    // Fall through to normal PROPFIND
  }
  const response = await buildPropfindResponse(createDataLoaderAdapter(persist), urlPath, segments, normalizedDepth, logger, shouldIgnore, bodyText ?? undefined);
  return { response };
}

import type { PersistAdapter, Stat } from "../persist/types";
import { createDataLoaderAdapter } from "../persist/dataloader-adapter";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { DavResponse } from "../../webdav/handlers/types";

async function statOrNull(persist: PersistAdapter, path: string[]): Promise<Stat | null> {
  try { return await persist.stat(path); } catch { return null; }
}

type PropfindMode = { mode: "allprop" } | { mode: "propname" } | { mode: "prop"; keys: string[] };

function parsePropfindBody(bodyText?: string): PropfindMode {
  if (!bodyText || bodyText.trim().length === 0) { return { mode: "allprop" }; }
  const lower = bodyText.toLowerCase();
  if (/<\s*[^>]*propname[^>]*\/>/i.test(bodyText) || lower.includes("<propname")) {
    return { mode: "propname" };
  }
  if (/<\s*[^>]*allprop[^>]*\/>/i.test(bodyText) || lower.includes("<allprop")) {
    return { mode: "allprop" };
  }
  const propBlock = /<\s*[^>]*prop[^>]*>([\s\S]*?)<\s*\/\s*[^>]*prop\s*>/i.exec(bodyText);
  if (!propBlock) { return { mode: "allprop" }; }
  const inner = propBlock[1] ?? "";
  const keys: string[] = [];
  const tagRe = /<\s*([A-Za-z0-9_:.-]+)\b[^>]*\/?\s*>/g;
  for (const m of inner.matchAll(tagRe)) {
    const tag = m[1];
    if (!tag) { continue; }
    const name = tag.trim();
    if (name.toLowerCase() === "prop") { continue; }
    keys.push(name);
  }
  return { mode: "prop", keys };
}

function computeEtag(st: Stat): string {
  return `W/"${String(st.size ?? 0)}-${st.mtime ?? ""}"`;
}

async function buildPropfindResponse(
  persist: PersistAdapter,
  urlPath: string,
  parts: string[],
  depth: string | null,
  logger?: WebDAVLogger,
  shouldIgnore?: (fullPath: string, baseName: string) => boolean,
  bodyText?: string,
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
  const mode = parsePropfindBody(bodyText);
  function defaultKeys(): string[] {
    return [
      "D:displayname",
      "D:getcontentlength",
      "D:resourcetype",
      "D:getlastmodified",
      "D:getetag",
    ];
  }
  function renderPropBlocks(name: string, st: Stat, keys: string[] | null, propnameOnly: boolean): { ok: string; nf: string } {
    const map: Record<string, string> = {
      "D:displayname": name,
      "D:getcontentlength": String(st.size ?? 0),
      "D:resourcetype": st.type === "dir" ? "<D:collection/>" : "",
      "D:getlastmodified": st.mtime ?? "",
      "D:getetag": computeEtag(st),
    };
    const selected = keys ? keys : defaultKeys();
    const ok: string[] = [];
    const nf: string[] = [];
    for (const k of selected) {
      const has = Object.prototype.hasOwnProperty.call(map, k);
      if (!has) {
        nf.push(`<${k}/>`);
        continue;
      }
      if (propnameOnly) {
        ok.push(`<${k}/>`);
      } else if (k === "D:resourcetype") {
        ok.push(`<D:resourcetype>${map[k]}</D:resourcetype>`);
      } else {
        ok.push(`<${k}>${map[k]}</${k}>`);
      }
    }
    return { ok: ok.join("\n      "), nf: nf.join("\n      ") };
  }
  const selfName = parts[parts.length - 1] ?? "/";
  function blocksFor(name: string, st: Stat): { ok: string; nf: string } {
    if (mode.mode === "propname") {
      return renderPropBlocks(name, st, defaultKeys(), true);
    }
    if (mode.mode === "prop") {
      return renderPropBlocks(name, st, mode.keys, false);
    }
    return renderPropBlocks(name, st, null, false);
  }
  const selfBlocks = blocksFor(selfName, stat);
  const selfOk = `\n  <D:propstat>\n    <D:prop>\n      ${selfBlocks.ok}\n    </D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>`;
  function nfBlock(content: string): string {
    if (content && content.trim().length > 0) {
      return `\n  <D:propstat>\n    <D:prop>\n      ${content}\n    </D:prop>\n    <D:status>HTTP/1.1 404 Not Found</D:status>\n  </D:propstat>`;
    }
    return "";
  }
  const selfNf = nfBlock(selfBlocks.nf);
  const selfEntry = `\n<D:response>\n  <D:href>${selfHref}</D:href>${selfOk}${selfNf}\n</D:response>`;
  function pushEntry(parentHref: string, name: string, st: Stat) {
    const childIsDir = st.type === "dir";
    const childBlocks = blocksFor(name, st);
    const okBlock = `\n  <D:propstat>\n    <D:prop>\n      ${childBlocks.ok}\n    </D:prop>\n    <D:status>HTTP/1.1 200 OK</D:status>\n  </D:propstat>`;
    const nf = nfBlock(childBlocks.nf);
    entryParts.push(`\n<D:response>\n  <D:href>${parentHref}${encodeURIComponent(name)}${childIsDir ? "/" : ""}</D:href>${okBlock}${nf}\n</D:response>`);
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
