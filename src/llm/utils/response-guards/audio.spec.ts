/**
 * @file Unit tests for audio-related response guards.
 */
import { isAudioDeltaEvent, isAudioDoneEvent, isAudioTranscriptDeltaEvent, isAudioTranscriptDoneEvent } from "./audio";

describe("Audio event guards", () => {
  it("accepts valid audio delta/done", () => {
    expect(
      isAudioDeltaEvent({
        type: "response.audio.delta",
        delta: "base64",
        item_id: "id123",
        output_index: 0,
        content_index: 0,
      }),
    ).toBe(true);

    expect(
      isAudioDoneEvent({
        type: "response.audio.done",
        text: "transcript",
        item_id: "id123",
        output_index: 0,
        content_index: 0,
      }),
    ).toBe(true);
  });

  it("accepts valid transcript delta/done", () => {
    expect(
      isAudioTranscriptDeltaEvent({
        type: "response.audio_transcript.delta",
        delta: "t",
        item_id: "id123",
        output_index: 0,
        content_index: 0,
      }),
    ).toBe(true);
    expect(
      isAudioTranscriptDoneEvent({
        type: "response.audio_transcript.done",
        transcript: "T",
        item_id: "id123",
        output_index: 0,
        content_index: 0,
      }),
    ).toBe(true);
  });
});
