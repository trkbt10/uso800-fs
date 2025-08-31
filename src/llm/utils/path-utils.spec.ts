/**
 * @file Unit tests for path utilities
 */
import { pathToSegments, segmentsToDisplayPath, validateSegments, isRootPath } from "./path-utils";

describe("pathToSegments", () => {
  it("converts root path to empty array", () => {
    expect(pathToSegments("/")).toEqual([]);
  });

  it("converts single segment path", () => {
    expect(pathToSegments("/foo")).toEqual(["foo"]);
  });

  it("converts multi-segment path", () => {
    expect(pathToSegments("/foo/bar/baz")).toEqual(["foo", "bar", "baz"]);
  });

  it("handles trailing slashes", () => {
    expect(pathToSegments("/foo/bar/")).toEqual(["foo", "bar"]);
  });

  it("handles multiple consecutive slashes", () => {
    expect(pathToSegments("/foo//bar///baz")).toEqual(["foo", "bar", "baz"]);
  });

  it("handles empty path as root", () => {
    expect(pathToSegments("")).toEqual([]);
  });

  it("CRITICAL: never creates 'root' segment for root path", () => {
    // This is the bug we're fixing
    expect(pathToSegments("/")).toEqual([]);
    expect(pathToSegments("/")).not.toContain("root");
  });
});

describe("segmentsToDisplayPath", () => {
  it("converts empty array to root path", () => {
    expect(segmentsToDisplayPath([])).toBe("/");
  });

  it("converts single segment", () => {
    expect(segmentsToDisplayPath(["foo"])).toBe("/foo");
  });

  it("converts multiple segments", () => {
    expect(segmentsToDisplayPath(["foo", "bar", "baz"])).toBe("/foo/bar/baz");
  });
});

describe("validateSegments", () => {
  it("accepts valid segments", () => {
    expect(() => validateSegments([])).not.toThrow();
    expect(() => validateSegments(["foo", "bar"])).not.toThrow();
    expect(() => validateSegments(["file.txt", "dir-name", "123"])).not.toThrow();
  });

  it("rejects segments with slashes", () => {
    expect(() => validateSegments(["foo/bar"])).toThrow("Invalid path segment containing slash");
  });

  it("rejects dot segments", () => {
    expect(() => validateSegments(["."])).toThrow('Invalid path segment: "."');
    expect(() => validateSegments([".."])).toThrow('Invalid path segment: ".."');
  });

  it("rejects empty segments", () => {
    expect(() => validateSegments([""])).toThrow("Empty path segment not allowed");
  });
});

describe("isRootPath", () => {
  it("identifies root path", () => {
    expect(isRootPath([])).toBe(true);
  });

  it("identifies non-root paths", () => {
    expect(isRootPath(["foo"])).toBe(false);
    expect(isRootPath(["foo", "bar"])).toBe(false);
  });
});
