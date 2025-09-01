/**
 * @file SEARCH handler (minimal contains query)
 */
import { createDataLoaderAdapter } from "../persist/dataloader-adapter";
import type { PersistAdapter, Stat } from "../persist/types";
import type { HandlerOptions, HandlerResult } from "./types";
import { pathToSegments } from "../../utils/path-utils";

function extractContains(bodyText: string): string | null {
  const m = /<\s*(?:[A-Za-z]+:)?contains\b[^>]*>([\s\S]*?)<\s*\/\s*(?:[A-Za-z]+:)?contains\s*>/i.exec(bodyText);
  if (!m) { return null; }
  const inner = (m[1] ?? "").trim();
  return inner.length > 0 ? inner : null;
}

async function statOrNull(persist: PersistAdapter, parts: string[]): Promise<Stat | null> {
  try { return await persist.stat(parts); } catch { return null; }
}

/**
 * Collects all file paths (as parts) under the given start path.
 * Appears simple, but breadth-first traversal avoids deep recursion.
 */
async function collectFiles(persist: PersistAdapter, start: string[]): Promise<string[][]> {
  const results: string[][] = [];
  const queue: string[][] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const st = await statOrNull(persist, cur);
    if (!st) { continue; }
    if (st.type === "file") {
      results.push(cur);
      continue;
    }
    const names = await persist.readdir(cur).catch(() => []);
    for (const n of names) { queue.push([...cur, n]); }
  }
  return results;
}

/**
 * Handles SEARCH with a minimal <contains> query. Returns 207 Multi-Status
 * with matching resource hrefs. If body lacks a query, returns all files.
 */
export async function handleSearchRequest(urlPath: string, options: HandlerOptions, bodyText: string): Promise<HandlerResult> {
  const { persist, logger } = options;
  const segments = pathToSegments(urlPath);
  logger?.logInput("SEARCH", urlPath);
  const contains = extractContains(bodyText) ?? "";
  const p = createDataLoaderAdapter(persist);
  const exists = await p.exists(segments);
  if (!exists) { return { response: { status: 404 } }; }
  const files = await collectFiles(p, segments);
  const needle = contains.toLowerCase();
  const matched = needle ? files.filter((parts) => (parts[parts.length - 1] ?? "").toLowerCase().includes(needle)) : files;
  const href = urlPath.endsWith("/") ? urlPath : urlPath + "/";
  const header = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">`;
  const entries = matched.map((parts) => {
    const name = parts[parts.length - 1] ?? "";
    return `\n<D:response>\n  <D:href>${href}${encodeURIComponent(name)}</D:href>\n  <D:status>HTTP/1.1 200 OK</D:status>\n</D:response>`;
  });
  const footer = "</D:multistatus>";
  logger?.logOutput("SEARCH", urlPath, 207);
  return { response: { status: 207, headers: { "Content-Type": "application/xml" }, body: [header, ...entries, footer].join("") } };
}
