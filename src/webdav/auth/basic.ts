/**
 * @file WebDAV auth hook helpers (Basic and Bearer)
 */
import type { WebDavHooks } from "../hooks";
import type { DavResponse } from "../handlers/types";

function unauthorizedWWWBasic(realm = "WebDAV"): DavResponse {
  return {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  };
}

function forbidden(): DavResponse {
  return { status: 403 };
}

/**
 * Creates hooks with Basic authentication.
 * - Sends 401 with WWW-Authenticate on missing/invalid credentials.
 */
export function createBasicAuthHooks(user: string, pass: string, realm = "WebDAV"): WebDavHooks {
  const expected = Buffer.from(`${user}:${pass}`).toString("base64");
  return {
    async authorize({ authorization }) {
      if (!authorization || authorization.scheme !== "Basic") {
        return unauthorizedWWWBasic(realm);
      }
      if (authorization.token !== expected) {
        return unauthorizedWWWBasic(realm);
      }
      return undefined;
    },
  };
}

/**
 * Creates hooks with Bearer token authentication.
 * - Sends 401 if missing, 403 if mismatched.
 */
export function createBearerAuthHooks(token: string): WebDavHooks {
  return {
    async authorize({ authorization }) {
      if (!authorization || authorization.scheme !== "Bearer") {
        return { status: 401 };
      }
      if (authorization.token !== token) {
        return forbidden();
      }
      return undefined;
    },
  };
}
