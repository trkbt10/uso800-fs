/**
 * @file Shared types for server handlers
 */
import type { PersistAdapter } from "../persist/types";
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
  /** When true, PROPFIND omits 404 propstat blocks (Microsoft 'Brief: t' / Prefer:return=minimal absorption). */
  omit404Propstat?: boolean;
  /** When true, add Preference-Applied: return=minimal to response headers. */
  appliedReturnMinimal?: boolean;
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
