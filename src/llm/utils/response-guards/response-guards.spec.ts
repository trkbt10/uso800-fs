/**
 * @file Tests for response event type guards.
 */
import { describe, it, expect } from "vitest";
import type { Responses } from "openai/resources/responses/responses";
import {
  // Common utilities
  hasTypeProp,
  isNumber,
  isString,
  isObject,
  asRecord,
  
  // Audio events
  isAudioDeltaEvent,
  isAudioDoneEvent,
  isAudioTranscriptDeltaEvent,
  isAudioTranscriptDoneEvent,
  
  // Code interpreter events
  isCodeInterpreterCodeDeltaEvent,
  isCodeInterpreterCodeDoneEvent,
  isCodeInterpreterCompletedEvent,
  isCodeInterpreterInProgressEvent,
  isCodeInterpreterInterpretingEvent,
  
  // Core response events
  isResponseStreamEvent,
  isResponseCreatedEvent,
  isResponseCompletedEvent,
  isResponseInProgressEvent,
  isResponseFailedEvent,
  isResponseIncompleteEvent,
  isResponseErrorEvent,
  isResponseQueuedEvent,
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
  
  // Content events
  isContentPartAddedEvent,
  isContentPartDoneEvent,
  
  // File search events
  isFileSearchCompletedEvent,
  isFileSearchInProgressEvent,
  isFileSearchSearchingEvent,
  
  // Function call events
  isArgsDeltaEvent,
  isArgsDoneEvent,
  isFunctionCallItem,
  extractOutputItem,
  
  // Text events
  isTextDeltaEvent,
  isTextDoneEvent,
  isOutputTextAnnotationAddedEvent,
  
  // Reasoning events
  isReasoningTextDeltaEvent,
  isReasoningTextDoneEvent,
  isReasoningSummaryPartAddedEvent,
  isReasoningSummaryPartDoneEvent,
  isReasoningSummaryTextDeltaEvent,
  isReasoningSummaryTextDoneEvent,
  
  // Refusal events
  isRefusalDeltaEvent,
  isRefusalDoneEvent,
  
  // Web search events
  isWebSearchCompletedEvent,
  isWebSearchInProgressEvent,
  isWebSearchSearchingEvent,
  
  // Image generation events
  isImageGenCompletedEvent,
  isImageGenGeneratingEvent,
  isImageGenInProgressEvent,
  isImageGenPartialImageEvent,
  
  // MCP events
  isMcpCallArgumentsDeltaEvent,
  isMcpCallArgumentsDoneEvent,
  isMcpCallCompletedEvent,
  isMcpCallFailedEvent,
  isMcpCallInProgressEvent,
  isMcpListToolsCompletedEvent,
  isMcpListToolsFailedEvent,
  isMcpListToolsInProgressEvent,
  
  // Custom tool call events
  isCustomToolCallInputDeltaEvent,
  isCustomToolCallInputDoneEvent,
} from "./index";

describe("Common utilities", () => {
  describe("hasTypeProp", () => {
    it("should return true for objects with matching type", () => {
      expect(hasTypeProp({ type: "test" }, "test")).toBe(true);
    });
    
    it("should return false for non-objects", () => {
      expect(hasTypeProp(null, "test")).toBe(false);
      expect(hasTypeProp(undefined, "test")).toBe(false);
      expect(hasTypeProp("string", "test")).toBe(false);
      expect(hasTypeProp(123, "test")).toBe(false);
    });
    
    it("should return false for objects without type", () => {
      expect(hasTypeProp({}, "test")).toBe(false);
      expect(hasTypeProp({ other: "field" }, "test")).toBe(false);
    });
    
    it("should return false for mismatched type", () => {
      expect(hasTypeProp({ type: "other" }, "test")).toBe(false);
    });
  });
  
  describe("isNumber", () => {
    it("should return true for numbers", () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });
    
    it("should return false for non-numbers", () => {
      expect(isNumber("123")).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber({})).toBe(false);
    });
  });
  
  describe("isString", () => {
    it("should return true for strings", () => {
      expect(isString("")).toBe(true);
      expect(isString("hello")).toBe(true);
      expect(isString("123")).toBe(true);
    });
    
    it("should return false for non-strings", () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
    });
  });
  
  describe("isObject", () => {
    it("should return true for objects", () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: "value" })).toBe(true);
      expect(isObject([])).toBe(true);
    });
    
    it("should return false for null", () => {
      expect(isObject(null)).toBe(false);
    });
    
    it("should return false for non-objects", () => {
      expect(isObject(undefined)).toBe(false);
      expect(isObject("string")).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });
  
  describe("asRecord", () => {
    it("should cast value to Record", () => {
      const obj = { key: "value" };
      const result = asRecord(obj);
      expect(result).toBe(obj);
      expect(result.key).toBe("value");
    });
  });
});

describe("Function call guards", () => {
  describe("isArgsDeltaEvent", () => {
    it("should accept valid arguments delta event", () => {
      const event = {
        type: "response.function_call_arguments.delta",
        delta: "args",
        item_id: "id123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isArgsDeltaEvent(null)).toBe(false);
      expect(isArgsDeltaEvent({})).toBe(false);
      expect(isArgsDeltaEvent({ type: "wrong" })).toBe(false);
      expect(isArgsDeltaEvent({
        type: "response.function_call_arguments.delta",
        // missing required fields
      })).toBe(false);
    });
  });
  
  describe("isArgsDoneEvent", () => {
    it("should accept valid arguments done event", () => {
      const event = {
        type: "response.function_call_arguments.done",
        arguments: "{}",
        item_id: "id123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDoneEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isArgsDoneEvent(null)).toBe(false);
      expect(isArgsDoneEvent({})).toBe(false);
      expect(isArgsDoneEvent({ type: "wrong" })).toBe(false);
    });
  });
  
  describe("isFunctionCallItem", () => {
    it("should return true for function call items", () => {
      const item = { type: "function_call", id: "123" } as Responses.ResponseOutputItem;
      expect(isFunctionCallItem(item)).toBe(true);
    });
    
    it("should return false for other item types", () => {
      const item = { type: "text", id: "123" } as Responses.ResponseOutputItem;
      expect(isFunctionCallItem(item)).toBe(false);
    });
  });
  
  describe("extractOutputItem", () => {
    it("should extract function call properties", () => {
      const item = {
        type: "function_call",
        id: "123",
        name: "test_func",
        arguments: "{}",
        call_id: "call_456",
      } as Responses.ResponseFunctionToolCall;
      
      const result = extractOutputItem(item);
      expect(result.id).toBe("123");
      expect(result.type).toBe("function_call");
      expect(result.name).toBe("test_func");
      expect(result.arguments).toBe("{}");
      expect(result.call_id).toBe("call_456");
    });
    
    it("should handle non-function items", () => {
      const item = {
        type: "text",
        id: "789",
      } as Responses.ResponseOutputItem;
      
      const result = extractOutputItem(item);
      expect(result.id).toBe("789");
      expect(result.type).toBe("text");
      expect(result.name).toBeUndefined();
      expect(result.arguments).toBeUndefined();
    });
  });
});

describe("Text event guards", () => {
  describe("isTextDeltaEvent", () => {
    it("should accept valid text delta event", () => {
      const event = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "text",
        item_id: "id123",
        output_index: 0,
      };
      expect(isTextDeltaEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isTextDeltaEvent(null)).toBe(false);
      expect(isTextDeltaEvent({})).toBe(false);
      expect(isTextDeltaEvent({ type: "wrong" })).toBe(false);
    });
  });
  
  describe("isTextDoneEvent", () => {
    it("should accept valid text done event", () => {
      const event = {
        type: "response.output_text.done",
        content_index: 0,
        text: "complete text",
        item_id: "id123",
        output_index: 0,
      };
      expect(isTextDoneEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isTextDoneEvent(null)).toBe(false);
      expect(isTextDoneEvent({})).toBe(false);
      expect(isTextDoneEvent({ type: "wrong" })).toBe(false);
    });
  });
});

describe("Core response event guards", () => {
  describe("isResponseStreamEvent", () => {
    it("should accept valid stream events", () => {
      const event = { type: "any.event.type" };
      expect(isResponseStreamEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isResponseStreamEvent(null)).toBe(false);
      expect(isResponseStreamEvent({})).toBe(false);
      expect(isResponseStreamEvent({ notType: "value" })).toBe(false);
    });
  });
  
  describe("isOutputItemAddedEvent", () => {
    it("should accept valid output item added event", () => {
      const event = {
        type: "response.output_item.added",
        item: { type: "text", id: "123" },
        output_index: 0,
        sequence_number: 1,
      };
      expect(isOutputItemAddedEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isOutputItemAddedEvent(null)).toBe(false);
      expect(isOutputItemAddedEvent({})).toBe(false);
      expect(isOutputItemAddedEvent({ type: "wrong" })).toBe(false);
      expect(isOutputItemAddedEvent({
        type: "response.output_item.added",
        // missing item
        output_index: 0,
      })).toBe(false);
    });
  });
  
  describe("isOutputItemDoneEvent", () => {
    it("should accept valid output item done event", () => {
      const event = {
        type: "response.output_item.done",
        item: { type: "text", id: "123" },
        output_index: 0,
        sequence_number: 1,
      };
      expect(isOutputItemDoneEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isOutputItemDoneEvent(null)).toBe(false);
      expect(isOutputItemDoneEvent({})).toBe(false);
      expect(isOutputItemDoneEvent({ type: "wrong" })).toBe(false);
    });
  });
});

describe("Audio event guards", () => {
  describe("isAudioDeltaEvent", () => {
    it("should accept valid audio delta event", () => {
      const event = {
        type: "response.audio.delta",
        delta: "audio_data",
        item_id: "id123",
        output_index: 0,
        content_index: 0,
      };
      expect(isAudioDeltaEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isAudioDeltaEvent(null)).toBe(false);
      expect(isAudioDeltaEvent({})).toBe(false);
      expect(isAudioDeltaEvent({ type: "wrong" })).toBe(false);
    });
  });
});

describe("MCP event guards", () => {
  describe("isMcpCallArgumentsDeltaEvent", () => {
    it("should accept valid MCP arguments delta event", () => {
      const event = {
        type: "response.mcp_call.arguments.delta",
        delta: "args",
        item_id: "id123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isMcpCallArgumentsDeltaEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isMcpCallArgumentsDeltaEvent(null)).toBe(false);
      expect(isMcpCallArgumentsDeltaEvent({})).toBe(false);
      expect(isMcpCallArgumentsDeltaEvent({ type: "wrong" })).toBe(false);
    });
  });
});

describe("Refusal event guards", () => {
  describe("isRefusalDeltaEvent", () => {
    it("should accept valid refusal delta event", () => {
      const event = {
        type: "response.refusal.delta",
        delta: "refusal text",
        item_id: "id123",
        output_index: 0,
      };
      expect(isRefusalDeltaEvent(event)).toBe(true);
    });
    
    it("should reject invalid events", () => {
      expect(isRefusalDeltaEvent(null)).toBe(false);
      expect(isRefusalDeltaEvent({})).toBe(false);
      expect(isRefusalDeltaEvent({ type: "wrong" })).toBe(false);
    });
  });
});
