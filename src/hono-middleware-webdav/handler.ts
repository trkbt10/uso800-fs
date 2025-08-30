/**
 * @file Minimal WebDAV handlers for OPTIONS, PROPFIND, MKCOL, GET, HEAD.
 *
 * This module is framework-agnostic: Hono routes call these functions.
 */
import type { FsState, FsEntry } from "../fakefs/state";
import { getEntry, ensureDir, putFile, removeEntry, moveEntry, copyEntry } from "../fakefs/state";
import { generateListingForFolder, fabricateFileContent } from "../fakefs/generation";

export type DavResponse = { status: number; headers?: Record<string, string>; body?: string | Uint8Array };






/**
 * Handle WebDAV OPTIONS request.
 */
export function handleOptions(): DavResponse {
  return {
    status: 200,
    headers: {
      DAV: "1,2",
      "MS-Author-Via": "DAV",
      Allow: "OPTIONS, PROPFIND, MKCOL, GET, HEAD",
    },
  };
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter((p) => p.length > 0);
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function propfindResponseForEntry(href: string, e: FsEntry): string {
  const isDir = e.type === "dir";
  const display = xmlEscape(e.name);
  const size = isDir ? 0 : e.size;
  return `
<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:displayname>${display}</D:displayname>
      <D:getcontentlength>${size}</D:getcontentlength>
      <D:resourcetype>${isDir ? "<D:collection/>" : ""}</D:resourcetype>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}






/**
 * Handle WebDAV PROPFIND request.
 */
export function handlePropfind(state: FsState, urlPath: string, depth: string | null): DavResponse {
  const parts = splitPath(urlPath);
  const target = parts.length === 0 ? state.root : getEntry(state, parts);
  if (!target) {
    return { status: 404 };
  }
  // Depth: 0 -> only self; 1 -> include children
  const selfHref = urlPath.endsWith("/") ? urlPath : urlPath + "/";
  const xmlParts = [`<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">`, propfindResponseForEntry(selfHref, target)];
  if (depth !== "0" && target.type === "dir") {
    for (const [name, child] of target.children.entries()) {
      xmlParts.push(propfindResponseForEntry(selfHref + encodeURIComponent(name) + (child.type === "dir" ? "/" : ""), child));
    }
  }
  xmlParts.push("</D:multistatus>");
  return { status: 207, headers: { "Content-Type": "application/xml" }, body: xmlParts.join("") };
}






/**
 * Handle WebDAV MKCOL (make collection/directory) request.
 */
export function handleMkcol(state: FsState, urlPath: string, opts?: { onGenerate?: (folder: string[]) => void }): DavResponse {
  const parts = splitPath(urlPath);
  if (parts.length === 0) {
    return { status: 403 };
  }
  // const dirName = parts[parts.length - 1]!; // Currently unused, kept for potential future use
  ensureDir(state, parts);
  // Generate mysterious entries based on name
  generateListingForFolder(state, parts);
  if (opts?.onGenerate) {
    opts.onGenerate(parts);
  }
  return { status: 201 };
}






/**
 * Handle HTTP GET request.
 */
export function handleGet(state: FsState, urlPath: string): DavResponse {
  const parts = splitPath(urlPath);
  const e = getEntry(state, parts);
  if (!e) {
    return { status: 404 };
  }
  if (e.type === "dir") {
    // Return simple HTML index
    const bodyParts = [`<html><body><h1>Index of /${parts.join("/")}</h1><ul>`];
    for (const [k, v] of e.children.entries()) {
      bodyParts.push(`<li><a href="${encodeURIComponent(k)}${v.type === "dir" ? "/" : ""}">${k}</a></li>`);
    }
    bodyParts.push("</ul></body></html>");
    const body = bodyParts.join("");
    return { status: 200, headers: { "Content-Type": "text/html" }, body };
  }
  // file
  // eslint-disable-next-line no-restricted-syntax -- Mutation needed for lazy content generation
  let content = e.content;
  if (!content) {
    content = fabricateFileContent(parts);
    putFile(state, parts, content, e.mime ?? "text/plain");
  }
  return { status: 200, headers: { "Content-Type": e.mime ?? "text/plain" }, body: content };
}






/**
 * Handle HTTP HEAD request.
 */
export function handleHead(state: FsState, urlPath: string): DavResponse {
  const parts = splitPath(urlPath);
  const e = getEntry(state, parts);
  if (!e) {
    return { status: 404 };
  }
  if (e.type === "dir") {
    return { status: 200, headers: { "Content-Type": "text/html" } };
  }
  return { status: 200, headers: { "Content-Type": e.mime ?? "text/plain", "Content-Length": String(e.size) } };
}






/**
 * Handle HTTP PUT request to upload files.
 */
export function handlePut(state: FsState, urlPath: string, body: string, contentType?: string): DavResponse {
  const parts = splitPath(urlPath);
  if (parts.length === 0) {
    return { status: 400 };
  }
  const file = putFile(state, parts, body, contentType ?? "application/octet-stream");
  return { status: 201, headers: { "Content-Length": String(file.size), "Content-Type": file.mime ?? "application/octet-stream" } };
}






/**
 * Handle HTTP DELETE request.
 */
export function handleDelete(state: FsState, urlPath: string): DavResponse {
  const parts = splitPath(urlPath);
  const ok = removeEntry(state, parts);
  return { status: ok ? 204 : 404 };
}






/**
 * Handle WebDAV MOVE request.
 */
export function handleMove(state: FsState, fromPath: string, destPath: string): DavResponse {
  const from = splitPath(fromPath);
  const to = splitPath(destPath);
  const ok = moveEntry(state, from, to);
  return { status: ok ? 201 : 404 };
}






/**
 * Handle WebDAV COPY request.
 */
export function handleCopy(state: FsState, fromPath: string, destPath: string): DavResponse {
  const from = splitPath(fromPath);
  const to = splitPath(destPath);
  const ok = copyEntry(state, from, to);
  return { status: ok ? 201 : 404 };
}
