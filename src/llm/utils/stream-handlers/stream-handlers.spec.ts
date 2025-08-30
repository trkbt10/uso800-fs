/**
 * @file Tests for stream event handlers.
 */
import { describe, it, expect } from "vitest";
import type { Responses } from "openai/resources/responses/responses";
import { handleTextDeltaEvent } from "./text-delta";
import { handleTextDoneEvent } from "./text-done";
import { handleOutputItemDoneEvent } from "./output-item-done";
import type { StreamAccumulator } from "./types";

describe("Stream handlers", () => {
  /**
   * Create a mock accumulator for testing.
   */
  function createMockAccumulator(): StreamAccumulator {
    return {
      accumulated: "",
      argAccumulated: new Map(),
      itemAdded: false,
      outputDone: false,
      toolCalls: new Map(),
    };
  }
  
  describe("handleTextDeltaEvent", () => {
    it("should accumulate text delta", () => {
      const acc = createMockAccumulator();
      const event: Responses.ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "Hello ",
        item_id: "item1",
        output_index: 0,
      };
      
      const result = handleTextDeltaEvent(event, acc);
      expect(result).toBe("Hello ");
      expect(acc.accumulated).toBe("Hello ");
    });
    
    it("should append to existing accumulated text", () => {
      const acc = createMockAccumulator();
      acc.accumulated = "Hi ";
      
      const event: Responses.ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "there",
        item_id: "item1",
        output_index: 0,
      };
      
      const result = handleTextDeltaEvent(event, acc);
      expect(result).toBe("there");
      expect(acc.accumulated).toBe("Hi there");
    });
    
    it("should handle empty delta", () => {
      const acc = createMockAccumulator();
      const event: Responses.ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "",
        item_id: "item1",
        output_index: 0,
      };
      
      const result = handleTextDeltaEvent(event, acc);
      expect(result).toBe("");
      expect(acc.accumulated).toBe("");
    });
  });
  
  describe("handleTextDoneEvent", () => {
    it("should return complete text and reset accumulator", () => {
      const acc = createMockAccumulator();
      acc.accumulated = "Partial text ";
      
      const event: Responses.ResponseTextDoneEvent = {
        type: "response.output_text.done",
        content_index: 0,
        text: "Complete text message",
        item_id: "item1",
        output_index: 0,
      };
      
      const result = handleTextDoneEvent(event, acc);
      expect(result).toBe("Complete text message");
      expect(acc.accumulated).toBe("");
    });
    
    it("should handle empty text", () => {
      const acc = createMockAccumulator();
      acc.accumulated = "Some partial";
      
      const event: Responses.ResponseTextDoneEvent = {
        type: "response.output_text.done",
        content_index: 0,
        text: "",
        item_id: "item1",
        output_index: 0,
      };
      
      const result = handleTextDoneEvent(event, acc);
      expect(result).toBe("");
      expect(acc.accumulated).toBe("");
    });
  });
  
  describe("handleOutputItemDoneEvent", () => {
    it("should handle function call output item", () => {
      const acc = createMockAccumulator();
      const functionItem: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "func123",
        name: "test_function",
        arguments: '{"key": "value"}',
        call_id: "call456",
      };
      
      const event: Responses.ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: functionItem,
        output_index: 0,
        sequence_number: 1,
      };
      
      const result = handleOutputItemDoneEvent(event, acc);
      expect(result).toEqual({
        name: "test_function",
        arguments: '{"key": "value"}',
      });
      expect(acc.outputDone).toBe(true);
    });
    
    it("should handle text output item", () => {
      const acc = createMockAccumulator();
      const textItem: Responses.ResponseMessageContentTextOutput = {
        type: "text",
        text: "Output text",
      };
      
      const event: Responses.ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: textItem,
        output_index: 0,
        sequence_number: 1,
      };
      
      const result = handleOutputItemDoneEvent(event, acc);
      expect(result).toBeUndefined();
      expect(acc.outputDone).toBe(true);
    });
    
    it("should clear argAccumulated on function call", () => {
      const acc = createMockAccumulator();
      acc.argAccumulated.set("old_id", "old_args");
      
      const functionItem: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "func123",
        name: "test_function",
        arguments: "{}",
        call_id: "call456",
      };
      
      const event: Responses.ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: functionItem,
        output_index: 0,
        sequence_number: 1,
      };
      
      handleOutputItemDoneEvent(event, acc);
      expect(acc.argAccumulated.size).toBe(0);
    });
    
    it("should store tool call information", () => {
      const acc = createMockAccumulator();
      const functionItem: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "func123",
        name: "calculator",
        arguments: '{"operation": "add", "a": 1, "b": 2}',
        call_id: "call789",
      };
      
      const event: Responses.ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: functionItem,
        output_index: 0,
        sequence_number: 1,
      };
      
      handleOutputItemDoneEvent(event, acc);
      expect(acc.toolCalls.has("func123")).toBe(true);
      
      const storedCall = acc.toolCalls.get("func123");
      expect(storedCall?.name).toBe("calculator");
      expect(storedCall?.arguments).toBe('{"operation": "add", "a": 1, "b": 2}');
      expect(storedCall?.call_id).toBe("call789");
    });
    
    it("should handle items without type", () => {
      const acc = createMockAccumulator();
      const unknownItem = {
        id: "unknown123",
        // no type field
      } as unknown as Responses.ResponseOutputItem;
      
      const event: Responses.ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: unknownItem,
        output_index: 0,
        sequence_number: 1,
      };
      
      const result = handleOutputItemDoneEvent(event, acc);
      expect(result).toBeUndefined();
      expect(acc.outputDone).toBe(true);
    });
  });
});
