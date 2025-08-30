/**
 * @file Unit tests for text-related response guards.
 */
import { isOutputTextAnnotationAddedEvent, isTextDeltaEvent, isTextDoneEvent } from "./text";

describe("Text event guards", () => {
  it("accepts valid text delta/done", () => {
    expect(
      isTextDeltaEvent({
        type: "response.output_text.delta",
        content_index: 0,
        delta: "t",
        item_id: "id123",
        output_index: 0,
      }),
    ).toBe(true);

    expect(
      isTextDoneEvent({
        type: "response.output_text.done",
        content_index: 0,
        text: "T",
        item_id: "id123",
        output_index: 0,
      }),
    ).toBe(true);
  });

  it("rejects invalid", () => {
    expect(isTextDeltaEvent(null)).toBe(false);
    expect(isTextDoneEvent({})).toBe(false);
  });

  it("accepts output text annotation added", () => {
    expect(
      isOutputTextAnnotationAddedEvent({
        type: "response.output_text.annotation.added",
        item_id: "i",
        output_index: 0,
        content_index: 0,
        annotation_index: 0,
        annotation: { type: "file_citation", file_id: "f", quote: "q" },
      }),
    ).toBe(true);
  });
});
