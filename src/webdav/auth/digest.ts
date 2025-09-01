/**
 * @file HTTP Digest helpers: nonce issuance/verification and response hashes.
 * Minimal baseline for qop="auth". This file does not wire into server by default.
 */
import { createHash, randomBytes } from "node:crypto";

/**
 * Issues a base64url nonce embedding timestamp and random bytes.
 */
export function issueNonce(ttlSeconds: number): string {
  const ts = Date.now();
  const rand = randomBytes(12).toString("base64url");
  const payload = JSON.stringify({ ts, r: rand, t: ttlSeconds });
  return Buffer.from(payload).toString("base64url");
}

/**
 * Verifies nonce freshness. Returns true if within ttl; false when stale/invalid.
 */
export function verifyNonce(nonce: string): boolean {
  try {
    const txt = Buffer.from(nonce, "base64url").toString("utf8");
    const obj = JSON.parse(txt) as { ts?: number; t?: number };
    const ts = typeof obj.ts === "number" ? obj.ts : 0;
    const ttl = typeof obj.t === "number" ? obj.t : 0;
    if (ts <= 0 || ttl <= 0) { return false; }
    const now = Date.now();
    return (now - ts) <= ttl * 1000;
  } catch {
    return false;
  }
}

/**
 * MD5 utility that returns lowercase hex.
 */
function md5Hex(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

/**
 * Computes HA1 per RFC: MD5(username:realm:password)
 */
export function computeHA1(username: string, realm: string, password: string): string {
  return md5Hex(`${username}:${realm}:${password}`);
}

/**
 * Computes HA2 per RFC: MD5(method:digestURI) for qop="auth".
 */
export function computeHA2(method: string, digestUri: string): string {
  return md5Hex(`${method}:${digestUri}`);
}

/**
 * Computes response: MD5(HA1:nonce:nc:cnonce:qop:HA2) for qop="auth".
 */
export function computeResponse(ha1: string, nonce: string, nc: string, cnonce: string, qop: string, ha2: string): string {
  return md5Hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
}

/**
 * Parsed Digest Authorization header (minimal fields for qop=auth).
 */
export type DigestAuth = {
  username: string;
  realm: string;
  nonce: string;
  uri: string;
  response: string;
  qop?: string;
  nc?: string;
  cnonce?: string;
};

const tokenRe = /([a-zA-Z][a-zA-Z0-9_-]*)="?([^",]+)"?/g;

/**
 * Parses an Authorization: Digest ... header into a DigestAuth object.
 * Returns null when the scheme is not Digest or required fields are missing.
 */
export function parseDigestAuth(header: string | undefined | null): DigestAuth | null {
  if (!header) { return null; }
  if (!header.trim().toLowerCase().startsWith("digest ")) { return null; }
  const body = header.slice(7);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(tokenRe)) {
    const k = (m[1] ?? "").toLowerCase();
    const v = (m[2] ?? "").trim();
    if (k) { out[k] = v; }
  }
  const need = ["username", "realm", "nonce", "uri", "response"];
  for (const k of need) { if (!out[k]) { return null; } }
  return {
    username: out.username,
    realm: out.realm,
    nonce: out.nonce,
    uri: out.uri,
    response: out.response,
    qop: out.qop,
    nc: out.nc,
    cnonce: out.cnonce,
  };
}
