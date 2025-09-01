/**
 * @file Unit tests for HTTP Digest helpers
 */
import { issueNonce, verifyNonce, computeHA1, computeHA2, computeResponse, parseDigestAuth } from "./digest";

describe("digest helpers", () => {
  it("issues and verifies nonce within ttl", async () => {
    const n = issueNonce(1);
    expect(verifyNonce(n)).toBe(true);
  });

  it("parses Digest header and computes response", async () => {
    const ha1 = computeHA1("Mufasa", "testrealm@host.com", "Circle Of Life");
    const ha2 = computeHA2("GET", "/dir/index.html");
    const resp = computeResponse(ha1, "dcd98b7102dd2f0e8b11d0f600bfb0c093", "00000001", "0a4f113b", "auth", ha2);
    expect(resp).toHaveLength(32);
    const header = 'Digest username="Mufasa", realm="testrealm@host.com", nonce="abc", uri="/dir/index.html", response="' + resp + '", qop=auth, nc=00000001, cnonce="0a4f113b"';
    const parsed = parseDigestAuth(header);
    expect(parsed?.username).toBe("Mufasa");
    expect(parsed?.qop).toBe("auth");
  });
});

