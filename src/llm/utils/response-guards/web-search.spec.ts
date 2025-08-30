/**
 * @file Unit tests for web-search related guards.
 */
import { isWebSearchCompletedEvent, isWebSearchInProgressEvent, isWebSearchSearchingEvent } from "./web-search";

describe("Web-search event guards", () => {
  it("accepts searching/in_progress/completed", () => {
    expect(
      isWebSearchSearchingEvent({ type: "response.web_search.searching", item_id: "i", call_id: "c" }),
    ).toBe(true);
    expect(
      isWebSearchInProgressEvent({ type: "response.web_search.in_progress", item_id: "i", call_id: "c" }),
    ).toBe(true);
    expect(
      isWebSearchCompletedEvent({ type: "response.web_search.completed", item_id: "i", call_id: "c", results: [] }),
    ).toBe(true);
  });
});
