/**
 * @file Unit tests for MCP-related response guards.
 */
import {
  isMcpCallArgumentsDeltaEvent,
  isMcpCallArgumentsDoneEvent,
  isMcpCallCompletedEvent,
  isMcpCallFailedEvent,
  isMcpCallInProgressEvent,
  isMcpListToolsCompletedEvent,
  isMcpListToolsFailedEvent,
  isMcpListToolsInProgressEvent,
} from "./mcp";

describe("MCP event guards", () => {
  it("accepts arguments delta/done", () => {
    expect(
      isMcpCallArgumentsDeltaEvent({
        type: "response.mcp_call.arguments.delta",
        delta: "{}",
        item_id: "i",
        output_index: 0,
        sequence_number: 1,
      }),
    ).toBe(true);
    expect(
      isMcpCallArgumentsDoneEvent({
        type: "response.mcp_call.arguments.done",
        arguments: "{}",
        item_id: "i",
        output_index: 0,
        sequence_number: 1,
        call_id: "c",
      }),
    ).toBe(true);
  });

  it("accepts call state events", () => {
    expect(
      isMcpCallInProgressEvent({ type: "response.mcp_call.in_progress", item_id: "i", call_id: "c" }),
    ).toBe(true);
    expect(
      isMcpCallCompletedEvent({ type: "response.mcp_call.completed", item_id: "i", call_id: "c", result: {} }),
    ).toBe(true);
    expect(
      isMcpCallFailedEvent({ type: "response.mcp_call.failed", item_id: "i", call_id: "c", error: {} }),
    ).toBe(true);
  });

  it("accepts list tools state events", () => {
    expect(isMcpListToolsInProgressEvent({ type: "response.mcp_list_tools.in_progress", item_id: "i" })).toBe(true);
    expect(
      isMcpListToolsCompletedEvent({ type: "response.mcp_list_tools.completed", item_id: "i", tools: [{ name: "t" }] }),
    ).toBe(true);
    expect(isMcpListToolsFailedEvent({ type: "response.mcp_list_tools.failed", item_id: "i", error: {} })).toBe(true);
  });
});
