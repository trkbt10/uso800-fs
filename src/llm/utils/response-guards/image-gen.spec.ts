/**
 * @file Unit tests for image-generation related guards.
 */
import {
  isImageGenCompletedEvent,
  isImageGenGeneratingEvent,
  isImageGenInProgressEvent,
  isImageGenPartialImageEvent,
} from "./image-gen";

describe("Image generation event guards", () => {
  it("accepts generating/in_progress/completed/partial_image", () => {
    expect(
      isImageGenGeneratingEvent({ type: "response.image_gen.generating", item_id: "i", call_id: "c" }),
    ).toBe(true);
    expect(isImageGenInProgressEvent({ type: "response.image_gen.in_progress", item_id: "i", call_id: "c" })).toBe(
      true,
    );
    expect(
      isImageGenCompletedEvent({ type: "response.image_gen.completed", item_id: "i", call_id: "c", image: "b64" }),
    ).toBe(true);
    expect(
      isImageGenPartialImageEvent({ type: "response.image_gen.partial_image", item_id: "i", call_id: "c", image: "b64" }),
    ).toBe(true);
  });
});
