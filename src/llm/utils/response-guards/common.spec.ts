/**
 * @file Unit tests for common response-guard utilities.
 */
import { asRecord, hasTypeProp, isNumber, isObject, isString } from "./common";

describe("Common utilities", () => {
  describe("hasTypeProp", () => {
    it("returns true for objects with matching type", () => {
      expect(hasTypeProp({ type: "x" }, "x")).toBe(true);
    });

    it("returns false for non-objects or mismatched type", () => {
      expect(hasTypeProp(null, "x")).toBe(false);
      expect(hasTypeProp(undefined, "x")).toBe(false);
      expect(hasTypeProp({ type: "y" }, "x")).toBe(false);
      expect(hasTypeProp({}, "x")).toBe(false);
    });
  });

  describe("isNumber / isString / isObject", () => {
    it("detects numbers", () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber("0")).toBe(false);
    });

    it("detects strings", () => {
      expect(isString("a")).toBe(true);
      expect(isString(1)).toBe(false);
    });

    it("detects objects", () => {
      expect(isObject({})).toBe(true);
      expect(isObject(null)).toBe(false);
    });
  });

  describe("asRecord", () => {
    it("casts values to record for internal guard use", () => {
      const r = asRecord({ a: 1 });
      expect(r.a).toBe(1);
    });
  });
});

