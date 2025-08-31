/**
 * @file Shared types for server handlers
 */
import type { PersistAdapter } from "../../persist/types";
import type { WebDAVLogger } from "../../logging/webdav-logger";

export type DavResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
};
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
