/**
 * @file ORDERPATCH handler (minimal). Supports two body forms:
 *  1) <orderpatch><order><order-member><segment>name</segment>...</order-member>...</order></orderpatch>
 *  2) <orderpatch><Z:names><Z:name>name</Z:name>...</Z:names></orderpatch>
 */
import type { HandlerOptions, HandlerResult } from "./types";
import { setOrder } from "../order";
import { pathToSegments } from "../../utils/path-utils";

function extractSegments(body: string): string[] {
  const segs: string[] = [];
  for (const m of body.matchAll(/<\s*(?:[A-Za-z]+:)?segment\b[^>]*>([\s\S]*?)<\s*\/\s*(?:[A-Za-z]+:)?segment\s*>/gi)) {
    const val = (m[1] ?? "").trim();
    if (val) { segs.push(val); }
  }
  if (segs.length > 0) { return segs; }
  for (const m of body.matchAll(/<\s*(?:[A-Za-z]+:)?name\b[^>]*>([\s\S]*?)<\s*\/\s*(?:[A-Za-z]+:)?name\s*>/gi)) {
    const val = (m[1] ?? "").trim();
    if (val) { segs.push(val); }
  }
  return segs;
}

/**
 * Applies order to a collection path.
 */
export async function handleOrderpatchRequest(urlPath: string, bodyText: string, options: HandlerOptions): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("ORDERPATCH", urlPath);
  const parts = pathToSegments(urlPath);
  const isDir = await persist.stat(parts).then((s) => s.type === "dir").catch(() => false);
  if (!isDir) { return { response: { status: 409 } }; }
  const names = extractSegments(bodyText);
  if (names.length === 0) { return { response: { status: 400 } }; }
  await setOrder(persist, urlPath, names);
  logger?.logOutput("ORDERPATCH", urlPath, 200);
  return { response: { status: 200 } };
}

