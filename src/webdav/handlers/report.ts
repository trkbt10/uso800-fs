/**
 * @file REPORT handler (minimal version-tree)
 */
import type { HandlerOptions, HandlerResult } from "./types";
import { listVersions } from "../versioning";

function wantsVersionTree(bodyText: string): boolean {
  const a = /<\s*(?:[A-Za-z]+:)?version-tree\b/i.test(bodyText);
  if (a) { return true; }
  const b = /<\s*(?:[A-Za-z]+:)?version-history\b/i.test(bodyText);
  if (b) { return true; }
  return false;
}

/**
 * Minimal REPORT handling for versioning: accepts <version-tree/> or
 * <version-history/> and returns a multistatus with version-id entries.
 */
export async function handleReportRequest(urlPath: string, options: HandlerOptions, bodyText: string): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("REPORT", urlPath);
  if (!wantsVersionTree(bodyText)) { return { response: { status: 400 } }; }
  const versions = await listVersions(persist, urlPath);
  const header = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:" xmlns:Z="urn:x">`;
  const entries = versions.map((v) => `\n<D:response>\n  <D:href>${urlPath}</D:href>\n  <Z:version-id>${v.id}</Z:version-id>\n  <Z:size>${String(v.size)}</Z:size>\n  <Z:createdAt>${v.createdAt}</Z:createdAt>\n</D:response>`);
  const footer = "</D:multistatus>";
  logger?.logOutput("REPORT", urlPath, 207);
  return { response: { status: 207, headers: { "Content-Type": "application/xml" }, body: [header, ...entries, footer].join("") } };
}
