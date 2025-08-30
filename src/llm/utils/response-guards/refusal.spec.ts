/**
 * @file Unit tests for refusal-related guards.
 */
import { isRefusalDeltaEvent, isRefusalDoneEvent } from "./refusal";

describe("Refusal event guards", () => {
  it("accepts delta/done", () => {
    expect(
      isRefusalDeltaEvent({
        type: "response.refusal.delta",
        delta: "no",
        item_id: "i",
        output_index: 0,
      }),
    ).toBe(true);

    expect(
      isRefusalDoneEvent({
        type: "response.refusal.done",
        refusal: "no",
        item_id: "i",
        output_index: 0,
        content_index: 0,
      }),
    ).toBe(true);
  });
});
