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
    async authorize({ headers }) {
      const auth = headers["authorization"] ?? headers["Authorization"];
      if (!auth || !auth.startsWith("Basic ")) {
        return unauthorizedWWWBasic(realm);
      }
      const token = auth.slice("Basic ".length).trim();
      if (token !== expected) {
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
    async authorize({ headers }) {
      const auth = headers["authorization"] ?? headers["Authorization"];
      if (!auth || !auth.startsWith("Bearer ")) {
        return { status: 401 };
      }
      const got = auth.slice("Bearer ".length).trim();
      if (got !== token) {
        return forbidden();
      }
      return undefined;
    },
  };
}

