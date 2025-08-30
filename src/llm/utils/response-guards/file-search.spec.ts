/**
 * @file Unit tests for file-search related guards.
 */
import { isFileSearchCompletedEvent, isFileSearchInProgressEvent, isFileSearchSearchingEvent } from "./file-search";

describe("File-search event guards", () => {
  it("accepts searching/in_progress/completed", () => {
    expect(
      isFileSearchSearchingEvent({
        type: "response.file_search.searching",
        item_id: "i",
        output_index: 0,
        call_id: "c",
      }),
    ).toBe(true);
    expect(
      isFileSearchInProgressEvent({
        type: "response.file_search.in_progress",
        item_id: "i",
        output_index: 0,
        call_id: "c",
      }),
    ).toBe(true);
    expect(
      isFileSearchCompletedEvent({
        type: "response.file_search.completed",
        item_id: "i",
        output_index: 0,
        call_id: "c",
        results: [],
      }),
    ).toBe(true);
  });
});
