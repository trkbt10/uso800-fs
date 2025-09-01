/**
 * @file Typed representation of Authorization header and helpers for WebDAV auth hooks.
 * Superficially a few interfaces; actually provides structured parsing to enable
 * type-safe, scheme-specific logic in user-provided hooks.
 */

export type AuthScheme = "Basic" | "Bearer" | "Digest" | "Other";

export type BasicAuthHeader = {
  scheme: "Basic";
  /** base64(username:password) */
  token: string;
};

export type BearerAuthHeader = {
  scheme: "Bearer";
  token: string;
};

/**
 * Digest auth parameters as defined in RFC 7616 (subset commonly used by WebDAV).
 * Note: qop may be "auth" or "auth-int". For qop="auth-int", entity-body hash is required
 * which can be validated later (e.g., in beforePut) because authorize hook runs pre-body.
 */
export type DigestAuthHeader = {
  scheme: "Digest";
  realm?: string;
  username?: string;
  nonce?: string;
  uri?: string;
  response?: string;
  opaque?: string;
  algorithm?: string; // e.g., MD5, SHA-256
  qop?: string; // e.g., auth, auth-int
  nc?: string; // nonce-count
  cnonce?: string;
  /**
   * All raw kv pairs for advanced/custom parameters
   */
  params: Record<string, string>;
};

export type OtherAuthHeader = {
  scheme: "Other";
  value: string;
};

export type ParsedAuthorization = BasicAuthHeader | BearerAuthHeader | DigestAuthHeader | OtherAuthHeader | undefined;

/**
 * Parses Authorization header into a typed structure.
 * Returns undefined if no Authorization is present.
 */
export function parseAuthorizationHeader(raw: string | undefined): ParsedAuthorization {
  if (!raw) { return undefined; }
  const [scheme, rest = ""] = raw.split(/\s+/, 2);
  const upper = scheme.trim();
  if (upper.toLowerCase() === "basic") {
    return { scheme: "Basic", token: rest.trim() };
  }
  if (upper.toLowerCase() === "bearer") {
    return { scheme: "Bearer", token: rest.trim() };
  }
  if (upper.toLowerCase() === "digest") {
    // Parse comma-separated k=v pairs; values may be quoted
    const params: Record<string, string> = {};
    const input = rest.trim();
    const re = /([a-zA-Z0-9_]+)=((?:"[^"]*")|[^,]*)/g;
    for (const m of input.matchAll(re)) {
      const k = m[1];
      const raw = (m[2]?.trim() ?? "");
      const val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
      params[k] = val;
    }
    const digest: DigestAuthHeader = {
      scheme: "Digest",
      params,
      realm: params["realm"],
      username: params["username"],
      nonce: params["nonce"],
      uri: params["uri"],
      response: params["response"],
      opaque: params["opaque"],
      algorithm: params["algorithm"],
      qop: params["qop"],
      nc: params["nc"],
      cnonce: params["cnonce"],
    };
    return digest;
  }
  return { scheme: "Other", value: rest.trim() };
}
