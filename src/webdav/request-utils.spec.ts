/**
 * @file Unit tests for request utilities
 */
import { headersToObject } from "./request-utils";

describe("request-utils", () => {
  it("converts Headers to plain object", () => {
    const h = new Headers({ A: "1", b: "2" });
    const obj = headersToObject(h);
    // Fetch Headers normalizes names to lowercase
    expect(obj["a"]).toBe("1");
    expect(obj["b"]).toBe("2");
  });
});
