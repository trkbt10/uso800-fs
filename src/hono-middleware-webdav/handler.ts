/**
 * @file WebDAV handlers that work directly with PersistAdapter.
 * 
 * This module is framework-agnostic: Hono routes call these functions.
 */
import type { PersistAdapter } from "../persist/types";
import type { WebDAVLogger } from "../logging/webdav-logger";

export type DavResponse = { 
  status: number; 
  headers?: Record<string, string>; 
  body?: string | Uint8Array 
};

/**
 * Handle WebDAV OPTIONS request.
 */
export function handleOptions(logger?: WebDAVLogger): DavResponse {
  if (logger) {
    logger.logOperation({ type: "OPTIONS", path: "*", timestamp: new Date().toISOString(), status: 200 });
  }
  return {
    status: 200,
    headers: {
      DAV: "1,2",
      "MS-Author-Via": "DAV",
      Allow: "OPTIONS, PROPFIND, MKCOL, GET, HEAD, PUT, DELETE, MOVE, COPY",
    },
  };
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter((p) => p.length > 0);
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Handle WebDAV PROPFIND request using PersistAdapter.
 */
export async function handlePropfind(
  persist: PersistAdapter,
  urlPath: string,
  depth: string | null,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  const parts = splitPath(urlPath);
  
  try {
    const exists = await persist.exists(parts);
    if (!exists) {
      if (logger) {
        logger.logList(urlPath, 404);
      }
      return { status: 404 };
    }

    const stat = await persist.stat(parts);
    const isDir = stat.type === "dir";
    
    // Build WebDAV XML response
    const selfHref = urlPath.endsWith("/") ? urlPath : urlPath + "/";
    const xmlParts = [
      `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">`,
    ];

    // Add self entry
    xmlParts.push(`
<D:response>
  <D:href>${selfHref}</D:href>
  <D:propstat>
    <D:prop>
      <D:displayname>${xmlEscape(parts[parts.length - 1] || "/")}</D:displayname>
      <D:getcontentlength>${stat.size || 0}</D:getcontentlength>
      <D:resourcetype>${isDir ? "<D:collection/>" : ""}</D:resourcetype>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`);

    // Add children if depth !== "0" and it's a directory
    let itemCount = 0;
    if (depth !== "0" && isDir) {
      try {
        const children = await persist.readdir(parts);
        itemCount = children.length;
        
        for (const name of children) {
          const childPath = [...parts, name];
          const childStat = await persist.stat(childPath);
          const childIsDir = childStat.type === "dir";
          
          xmlParts.push(`
<D:response>
  <D:href>${selfHref}${encodeURIComponent(name)}${childIsDir ? "/" : ""}</D:href>
  <D:propstat>
    <D:prop>
      <D:displayname>${xmlEscape(name)}</D:displayname>
      <D:getcontentlength>${childStat.size || 0}</D:getcontentlength>
      <D:resourcetype>${childIsDir ? "<D:collection/>" : ""}</D:resourcetype>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`);
        }
      } catch {
        // If readdir fails, just continue with no children
      }
    }
    
    xmlParts.push("</D:multistatus>");
    
    if (logger) {
      logger.logList(urlPath, 207, itemCount);
    }
    
    return { 
      status: 207, 
      headers: { "Content-Type": "application/xml" }, 
      body: xmlParts.join("") 
    };
  } catch (error) {
    if (logger) {
      logger.logList(urlPath, 500);
    }
    return { status: 500 };
  }
}

/**
 * Handle WebDAV MKCOL (make collection/directory) request.
 */
export async function handleMkcol(
  persist: PersistAdapter,
  urlPath: string,
  opts?: { logger?: WebDAVLogger; onGenerate?: (folder: string[]) => void }
): Promise<DavResponse> {
  const parts = splitPath(urlPath);
  if (parts.length === 0) {
    if (opts?.logger) {
      opts.logger.logCreate(urlPath, 403, true);
    }
    return { status: 403 };
  }
  
  try {
    await persist.ensureDir(parts);
    
    // Call onGenerate callback if provided (for LLM integration)
    if (opts?.onGenerate) {
      opts.onGenerate(parts);
    }
    
    if (opts?.logger) {
      opts.logger.logCreate(urlPath, 201, true);
    }
    return { status: 201 };
  } catch (error) {
    if (opts?.logger) {
      opts.logger.logCreate(urlPath, 500, true);
    }
    return { status: 500 };
  }
}

/**
 * Handle HTTP GET request.
 */
export async function handleGet(
  persist: PersistAdapter,
  urlPath: string,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  const parts = splitPath(urlPath);
  
  try {
    const exists = await persist.exists(parts);
    if (!exists) {
      if (logger) {
        logger.logRead(urlPath, 404);
      }
      return { status: 404 };
    }
    
    const stat = await persist.stat(parts);
    
    if (stat.type === "dir") {
      // Return simple HTML index for directories
      const children = await persist.readdir(parts);
      const bodyParts = [`<html><body><h1>Index of /${parts.join("/")}</h1><ul>`];
      
      for (const name of children) {
        const childPath = [...parts, name];
        try {
          const childStat = await persist.stat(childPath);
          const isDir = childStat.type === "dir";
          bodyParts.push(`<li><a href="${encodeURIComponent(name)}${isDir ? "/" : ""}">${name}</a></li>`);
        } catch {
          // Skip entries we can't stat
        }
      }
      
      bodyParts.push("</ul></body></html>");
      const body = bodyParts.join("");
      
      if (logger) {
        logger.logRead(urlPath, 200, body.length);
      }
      
      return { 
        status: 200, 
        headers: { "Content-Type": "text/html" }, 
        body 
      };
    } else {
      // Return file content
      const content = await persist.readFile(parts);
      
      if (logger) {
        logger.logRead(urlPath, 200, content.length);
      }
      
      return { 
        status: 200, 
        headers: { "Content-Type": "application/octet-stream" }, 
        body: content 
      };
    }
  } catch (error) {
    if (logger) {
      logger.logRead(urlPath, 500);
    }
    return { status: 500 };
  }
}

/**
 * Handle HTTP HEAD request.
 */
export async function handleHead(
  persist: PersistAdapter,
  urlPath: string,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  if (logger) {
    logger.logOperation({ type: "HEAD", path: urlPath, timestamp: new Date().toISOString() });
  }
  
  const parts = splitPath(urlPath);
  
  try {
    const exists = await persist.exists(parts);
    if (!exists) {
      return { status: 404 };
    }
    
    const stat = await persist.stat(parts);
    
    if (stat.type === "dir") {
      return { 
        status: 200, 
        headers: { "Content-Type": "text/html" } 
      };
    } else {
      return { 
        status: 200, 
        headers: { 
          "Content-Type": "application/octet-stream", 
          "Content-Length": String(stat.size || 0) 
        } 
      };
    }
  } catch {
    return { status: 500 };
  }
}

/**
 * Handle HTTP PUT request to upload files.
 */
export async function handlePut(
  persist: PersistAdapter,
  urlPath: string,
  body: string | Uint8Array,
  contentType?: string,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  const parts = splitPath(urlPath);
  if (parts.length === 0) {
    return { status: 400 };
  }
  
  try {
    // Ensure parent directory exists
    if (parts.length > 1) {
      await persist.ensureDir(parts.slice(0, -1));
    }
    
    // Convert string to Uint8Array if needed
    const data = typeof body === "string" 
      ? new TextEncoder().encode(body)
      : body;
    
    await persist.writeFile(parts, data, contentType);
    
    if (logger) {
      logger.logWrite(urlPath, 201, data.length);
    }
    
    return {
      status: 201,
      headers: { 
        "Content-Length": String(data.length), 
        "Content-Type": contentType || "application/octet-stream" 
      },
    };
  } catch (error) {
    if (logger) {
      logger.logWrite(urlPath, 500);
    }
    return { status: 500 };
  }
}

/**
 * Handle HTTP DELETE request.
 */
export async function handleDelete(
  persist: PersistAdapter,
  urlPath: string,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  const parts = splitPath(urlPath);
  
  try {
    const exists = await persist.exists(parts);
    if (!exists) {
      if (logger) {
        logger.logDelete(urlPath, 404);
      }
      return { status: 404 };
    }
    
    await persist.remove(parts, { recursive: true });
    
    if (logger) {
      logger.logDelete(urlPath, 204);
    }
    return { status: 204 };
  } catch (error) {
    if (logger) {
      logger.logDelete(urlPath, 500);
    }
    return { status: 500 };
  }
}

/**
 * Handle WebDAV MOVE request.
 */
export async function handleMove(
  persist: PersistAdapter,
  fromPath: string,
  destPath: string,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  const from = splitPath(fromPath);
  const to = splitPath(destPath);
  
  try {
    const exists = await persist.exists(from);
    if (!exists) {
      if (logger) {
        logger.logMove(fromPath, destPath, 404);
      }
      return { status: 404 };
    }
    
    // Ensure destination parent exists
    if (to.length > 1) {
      await persist.ensureDir(to.slice(0, -1));
    }
    
    await persist.move(from, to);
    
    if (logger) {
      logger.logMove(fromPath, destPath, 201);
    }
    return { status: 201 };
  } catch (error) {
    if (logger) {
      logger.logMove(fromPath, destPath, 500);
    }
    return { status: 500 };
  }
}

/**
 * Handle WebDAV COPY request.
 */
export async function handleCopy(
  persist: PersistAdapter,
  fromPath: string,
  destPath: string,
  logger?: WebDAVLogger
): Promise<DavResponse> {
  const from = splitPath(fromPath);
  const to = splitPath(destPath);
  
  try {
    const exists = await persist.exists(from);
    if (!exists) {
      if (logger) {
        logger.logCopy(fromPath, destPath, 404);
      }
      return { status: 404 };
    }
    
    // Ensure destination parent exists
    if (to.length > 1) {
      await persist.ensureDir(to.slice(0, -1));
    }
    
    await persist.copy(from, to);
    
    if (logger) {
      logger.logCopy(fromPath, destPath, 201);
    }
    return { status: 201 };
  } catch (error) {
    if (logger) {
      logger.logCopy(fromPath, destPath, 500);
    }
    return { status: 500 };
  }
}