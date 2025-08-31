/**
 * @file WebDAV request handlers - testable pure functions
 */
import type { PersistAdapter } from "../persist/types";
import type { WebDAVLogger } from "../logging/webdav-logger";
import { pathToSegments } from "../llm/utils/path-utils";
import {
  handleGet as webdavGet,
  handlePut as webdavPut,
  handlePropfind as webdavPropfind,
  handleMkcol as webdavMkcol,
  handleHead as webdavHead,
  handleDelete as webdavDelete,
  handleMove as webdavMove,
  handleCopy as webdavCopy,
  type DavResponse,
} from "../hono-middleware-webdav/handler";

/**
 * LLM interface for generating content
 */
export type LlmLike = {
  fabricateListing: (path: string[], opts?: { depth?: string | null }) => Promise<void>;
  fabricateFileContent: (path: string[], opts?: { mimeHint?: string }) => Promise<string>;
};

/**
 * Options for handler functions
 */
export type HandlerOptions = {
  persist: PersistAdapter;
  llm?: LlmLike;
  logger?: WebDAVLogger;
  shouldIgnore?: (fullPath: string, baseName: string) => boolean;
};

/**
 * Result from a handler function
 */
export type HandlerResult = {
  response: DavResponse;
  sideEffects?: {
    generated?: boolean;
    llmCalled?: boolean;
  };
};

/**
 * Handles GET request with optional LLM content generation.
 * This is a pure function that can be tested without HTTP context.
 */
export async function handleGetRequest(
  urlPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, llm, logger } = options;
  const segments = pathToSegments(urlPath);
  
  // Log input
  logger?.logInput("GET", urlPath);
  
  // Check if file exists
  const exists = await persist.exists(segments);
  if (exists) {
    // If it's an empty file and we have LLM, generate content once
    try {
      const stat = await persist.stat(segments);
      if (stat.type === "file" && (stat.size ?? 0) === 0 && llm) {
        const content = await llm.fabricateFileContent(segments);
        if (content) {
          if (segments.length > 1) {
            await persist.ensureDir(segments.slice(0, -1));
          }
          await persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
          const response = await webdavGet(persist, urlPath, logger);
          return { 
            response,
            sideEffects: { generated: true, llmCalled: true }
          };
        }
      }
    } catch {
      // Ignore errors and proceed with normal GET
    }
    
    const response = await webdavGet(persist, urlPath, logger);
    return { response };
  }
  
  // If not exists and we have LLM, generate content
  if (llm) {
    try {
      const content = await llm.fabricateFileContent(segments);
      if (content) {
        if (segments.length > 1) {
          await persist.ensureDir(segments.slice(0, -1));
        }
        await persist.writeFile(segments, new TextEncoder().encode(content), "text/plain");
        const response = await webdavGet(persist, urlPath, logger);
        return {
          response,
          sideEffects: { generated: true, llmCalled: true }
        };
      }
    } catch {
      // Ignore LLM errors
    }
  }
  
  // Return 404
  logger?.logRead(urlPath, 404);
  return {
    response: { status: 404 }
  };
}

/**
 * Handles PUT request with optional LLM content generation for empty bodies.
 */
export async function handlePutRequest(
  urlPath: string,
  body: ArrayBuffer | Uint8Array,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, llm, logger } = options;
  const segments = pathToSegments(urlPath);
  
  logger?.logInput("PUT", urlPath, { size: body.byteLength });
  
  const initialData = new Uint8Array(body);
  const resolved = await (async () => {
    if (initialData.byteLength === 0 && llm) {
      try {
        const content = await llm.fabricateFileContent(segments);
        if (content) {
          return {
            data: new TextEncoder().encode(content),
            contentType: "text/plain" as const,
            generated: true as const,
          };
        }
      } catch {
        // Fall through to use initial data
      }
    }
    return { data: initialData, contentType: undefined, generated: false as const };
  })();
  
  const response = await webdavPut(persist, urlPath, resolved.data, resolved.contentType, logger);
  return {
    response,
    sideEffects: resolved.generated ? { generated: true, llmCalled: true } : undefined
  };
}

/**
 * Handles PROPFIND request with optional LLM listing generation.
 */
export async function handlePropfindRequest(
  urlPath: string,
  depth: string | null | undefined,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, llm, logger, shouldIgnore } = options;
  const segments = pathToSegments(urlPath);
  
  logger?.logInput("PROPFIND", urlPath, { depth });
  
  // Check if exists
  const exists = await persist.exists(segments);
  if (exists) {
    // If directory exists but is empty and we have LLM, generate listing once
    if (llm) {
      try {
        const stat = await persist.stat(segments);
        if (stat.type === "dir") {
          const names = await persist.readdir(segments);
          if (names.length === 0) {
            await llm.fabricateListing(segments, { depth: depth ?? null });
            const response = await webdavPropfind(
              persist,
              urlPath,
              depth ?? null,
              logger,
              shouldIgnore ? { shouldIgnore } : undefined
            );
            return {
              response,
              sideEffects: { generated: true, llmCalled: true }
            };
          }
        }
      } catch {
        // Ignore errors and proceed with normal PROPFIND
      }
    }
    
    const response = await webdavPropfind(
      persist,
      urlPath,
      depth ?? null,
      logger,
      shouldIgnore ? { shouldIgnore } : undefined
    );
    return { response };
  }
  
  // If not exists and we have LLM, generate listing
  if (llm) {
    try {
      await llm.fabricateListing(segments, { depth: depth ?? null });
      // After generation, the directory should exist
      const response = await webdavPropfind(
        persist,
        urlPath,
        depth ?? null,
        logger,
        shouldIgnore ? { shouldIgnore } : undefined
      );
      return {
        response,
        sideEffects: { generated: true, llmCalled: true }
      };
    } catch {
      // Continue to 404 if LLM fails
    }
  }
  
  // Return 404
  logger?.logList(urlPath, 404);
  return {
    response: { status: 404 }
  };
}

/**
 * Handles MKCOL request to create a directory.
 */
export async function handleMkcolRequest(
  urlPath: string,
  options: HandlerOptions & { onGenerate?: (path: string[]) => void }
): Promise<HandlerResult> {
  const { persist, logger, onGenerate } = options;
  
  logger?.logInput("MKCOL", urlPath);
  
  // Create directory with proper onGenerate callback
  const response = await webdavMkcol(persist, urlPath, {
    logger,
    onGenerate: onGenerate
  });
  
  return { response };
}

/**
 * Creates an onGenerate callback for MKCOL that uses LLM if available.
 */
export function createMkcolOnGenerate(llm?: LlmLike): ((path: string[]) => void) | undefined {
  if (!llm) {
    return undefined;
  }
  
  return async (folder: string[]) => {
    try {
      await llm.fabricateListing(folder);
    } catch {
      // Ignore errors
    }
  };
}

/**
 * Handles HEAD request.
 */
export async function handleHeadRequest(
  urlPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("HEAD", urlPath);
  const response = await webdavHead(persist, urlPath, logger);
  return { response };
}

/**
 * Handles DELETE request.
 */
export async function handleDeleteRequest(
  urlPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("DELETE", urlPath);
  const response = await webdavDelete(persist, urlPath, logger);
  return { response };
}

/**
 * Handles MOVE request.
 */
export async function handleMoveRequest(
  fromPath: string,
  destPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("MOVE", fromPath, { destination: destPath });
  const response = await webdavMove(persist, fromPath, destPath, logger);
  return { response };
}

/**
 * Handles COPY request.
 */
export async function handleCopyRequest(
  fromPath: string,
  destPath: string,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, logger } = options;
  logger?.logInput("COPY", fromPath, { destination: destPath });
  const response = await webdavCopy(persist, fromPath, destPath, logger);
  return { response };
}
