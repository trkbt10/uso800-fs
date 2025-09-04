/**
 * @file WebDAV lifecycle hooks to intercept operations.
 *
 * These hooks are optional and async. Handlers call them (await) to allow
 * external logic (e.g., LLM) to intervene without coupling WebDAV core to it.
 */
import type { PersistAdapter } from "./persist/types";
import type { WebDAVLogger } from "../logging/webdav-logger";
import type { DavResponse } from "./handlers/types";
import type { ParsedAuthorization } from "./auth/types";

export type WebDavCommonContext = {
  urlPath: string;
  segments: string[];
  persist: PersistAdapter;
  logger?: WebDAVLogger;
};

export type WebDavGetContext = WebDavCommonContext & { getHeader?: (name: string) => string };
export type WebDavPropfindContext = WebDavCommonContext & { depth: string | null; getHeader?: (name: string) => string };
export type WebDavPutContext = WebDavCommonContext & {
  body: Uint8Array;
  // Mutator to replace request body and contentType before writing
  setBody: (next: Uint8Array, contentType?: string) => void;
};
export type WebDavMkcolContext = WebDavCommonContext & {};

// Generic request contexts
export type WebDavRequestContext = WebDavCommonContext & {
  method: string;
  headers: Record<string, string>;
  bodyText?: string;
};
export type WebDavReportContext = WebDavCommonContext & { bodyText: string; getHeader?: (name: string) => string };
export type WebDavOptionsContext = WebDavCommonContext & { getHeader?: (name: string) => string };

/**
 * Authentication/authorization context. Called before routing a request.
 * If a hook returns a DavResponse (e.g., 401/403), the request is short-circuited.
 */
export type WebDavAuthContext = WebDavCommonContext & {
  method: string;
  headers: Record<string, string>;
  /** Raw Authorization header (if any). */
  authorizationRaw?: string;
  /** Parsed Authorization header (Basic/Bearer/Digest/Other). */
  authorization?: ParsedAuthorization;
};

/**
 * WebDAV operation hooks. All are optional.
 * If a hook returns a DavResponse, the handler may short-circuit with it.
 * If a hook returns void, the handler proceeds normally.
 */
/**
 * Shared hook type utilities to avoid repetitive unions.
 */
export type HookResult = DavResponse | void;
export type MaybePromise<T> = T | Promise<T>;
export type Hook<Ctx> = (ctx: Ctx) => MaybePromise<HookResult>;
export type AfterHook<Ctx> = (ctx: Ctx, res: DavResponse) => MaybePromise<HookResult>;

export type WebDavHooks = {
  // Authorization (runs before any handler)
  authorize?: Hook<WebDavAuthContext>;

  // Generic request lifecycle
  beforeRequest?: Hook<WebDavRequestContext>;
  afterRequest?: AfterHook<WebDavRequestContext>;

  // GET
  beforeGet?: Hook<WebDavGetContext>;
  afterGet?: AfterHook<WebDavGetContext>;

  // PROPFIND
  beforePropfind?: Hook<WebDavPropfindContext>;
  afterPropfind?: AfterHook<WebDavPropfindContext>;

  // PUT (can mutate body via setBody)
  beforePut?: Hook<WebDavPutContext>;
  afterPut?: AfterHook<WebDavPutContext>;

  // MKCOL
  beforeMkcol?: Hook<WebDavMkcolContext>;
  afterMkcol?: AfterHook<WebDavMkcolContext>;

  // REPORT
  beforeReport?: Hook<WebDavReportContext>;
  afterReport?: AfterHook<WebDavReportContext>;

  // OPTIONS header adjustments
  afterOptions?: (ctx: WebDavOptionsContext, headers: Record<string, string>) => MaybePromise<Record<string, string> | void>;
};
