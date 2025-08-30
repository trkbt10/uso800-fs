/**
 * @file Unit tests for core response event guards.
 */
import {
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
  isResponseStreamEvent,
} from "./core";

describe("Core response event guards", () => {
  describe("isResponseStreamEvent", () => {
    it("accepts any object with type", () => {
      expect(isResponseStreamEvent({ type: "anything" })).toBe(true);
    });

    it("rejects invalid input", () => {
      expect(isResponseStreamEvent(null)).toBe(false);
      expect(isResponseStreamEvent({})).toBe(false);
    });
  });

  describe("isOutputItemAddedEvent", () => {
    it("accepts valid event shape", () => {
      const ev = {
        type: "response.output_item.added",
        item: { type: "text", id: "123" },
        output_index: 0,
        sequence_number: 1,
      };
      expect(isOutputItemAddedEvent(ev)).toBe(true);
    });

    it("rejects invalid input", () => {
      expect(isOutputItemAddedEvent(null)).toBe(false);
      expect(isOutputItemAddedEvent({})).toBe(false);
    });
  });

  describe("isOutputItemDoneEvent", () => {
    it("accepts valid event shape", () => {
      const ev = {
        type: "response.output_item.done",
        item: { type: "text", id: "123" },
        output_index: 0,
        sequence_number: 1,
      };
      expect(isOutputItemDoneEvent(ev)).toBe(true);
    });

    it("rejects invalid input", () => {
      expect(isOutputItemDoneEvent(null)).toBe(false);
      expect(isOutputItemDoneEvent({})).toBe(false);
    });
  });
});

