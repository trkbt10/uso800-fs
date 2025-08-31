/**
 * @file Shared types for server handlers
 */
import type { PersistAdapter } from "../../persist/types";
import type { WebDAVLogger } from "../../logging/webdav-logger";
import type { DavResponse } from "../../hono-middleware-webdav/handler";
import type { WebDavHooks } from "../../webdav/hooks";

/**
 * Options for handler functions
 */
export type HandlerOptions = {
  persist: PersistAdapter;
  hooks?: WebDavHooks;
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
