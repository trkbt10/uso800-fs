/**
 * @file WebDAV lifecycle hooks to intercept operations.
 *
 * These hooks are optional and async. Handlers call them (await) to allow
 * external logic (e.g., LLM) to intervene without coupling WebDAV core to it.
 */
import type { PersistAdapter } from "./persist/types";
import type { WebDAVLogger } from "../logging/webdav-logger";
import type { DavResponse } from "./handlers/types";

export type WebDavCommonContext = {
  urlPath: string;
  segments: string[];
  persist: PersistAdapter;
  logger?: WebDAVLogger;
};

export type WebDavGetContext = WebDavCommonContext & {};
export type WebDavPropfindContext = WebDavCommonContext & { depth: string | null };
export type WebDavPutContext = WebDavCommonContext & {
  body: Uint8Array;
  // Mutator to replace request body and contentType before writing
  setBody: (next: Uint8Array, contentType?: string) => void;
};
export type WebDavMkcolContext = WebDavCommonContext & {};

/**
 * Authentication/authorization context. Called before routing a request.
 * If a hook returns a DavResponse (e.g., 401/403), the request is short-circuited.
 */
export type WebDavAuthContext = WebDavCommonContext & {
  method: string;
  headers: Record<string, string>;
};

/**
 * WebDAV operation hooks. All are optional.
 * If a hook returns a DavResponse, the handler may short-circuit with it.
 * If a hook returns void, the handler proceeds normally.
 */
export type WebDavHooks = {
  // Authorization (runs before any handler)
  authorize?(ctx: WebDavAuthContext): Promise<DavResponse | void> | DavResponse | void;

  // GET
  beforeGet?(ctx: WebDavGetContext): Promise<DavResponse | void> | DavResponse | void;
  afterGet?(ctx: WebDavGetContext, res: DavResponse): Promise<DavResponse | void> | DavResponse | void;

  // PROPFIND
  beforePropfind?(ctx: WebDavPropfindContext): Promise<DavResponse | void> | DavResponse | void;
  afterPropfind?(ctx: WebDavPropfindContext, res: DavResponse): Promise<DavResponse | void> | DavResponse | void;

  // PUT (can mutate body via setBody)
  beforePut?(ctx: WebDavPutContext): Promise<DavResponse | void> | DavResponse | void;
  afterPut?(ctx: WebDavPutContext, res: DavResponse): Promise<DavResponse | void> | DavResponse | void;

  // MKCOL
  beforeMkcol?(ctx: WebDavMkcolContext): Promise<DavResponse | void> | DavResponse | void;
  afterMkcol?(ctx: WebDavMkcolContext, res: DavResponse): Promise<DavResponse | void> | DavResponse | void;
};
