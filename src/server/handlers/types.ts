/**
 * @file Shared types for server handlers
 */
import type { PersistAdapter } from "../../persist/types";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { DavResponse } from "../../hono-middleware-webdav/handler";

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

