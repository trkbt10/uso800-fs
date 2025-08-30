/**
 * @file Unit tests for re-exported response stream guards.
 */
import type { Responses } from "openai/resources/responses/responses";
import {
  isResponseStreamEvent,
  isOutputItemAddedEvent,
  isArgsDeltaEvent,
  isArgsDoneEvent,
  isOutputItemDoneEvent,
  extractOutputItem,
  isFunctionCallItem,
  isTextDeltaEvent,
  isTextDoneEvent,
} from "./response-stream-guards";

describe("response-stream-guards", () => {
  describe("isResponseStreamEvent", () => {
    it("should return true for valid event", () => {
      const event = { type: "response.created" };
      expect(isResponseStreamEvent(event)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isResponseStreamEvent(null)).toBe(false);
      expect(isResponseStreamEvent({})).toBe(false);
      expect(isResponseStreamEvent({ type: 123 })).toBe(false);
    });
  });

  describe("isOutputItemAddedEvent", () => {
    it("should return true for valid event", () => {
      // Create a valid ResponseOutputMessage
      const outputMessage: Responses.ResponseOutputMessage = {
        type: "message",
        id: "msg-123",
        content: [
          {
            type: "output_text",
            text: "Hello",
            annotations: [],
          },
        ],
        role: "assistant",
        status: "completed",
      };

      const event: Responses.ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: outputMessage,
        output_index: 0,
        sequence_number: 1,
      };
      expect(isOutputItemAddedEvent(event)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isOutputItemAddedEvent({ type: "wrong" })).toBe(false);
      expect(isOutputItemAddedEvent({ type: "response.output_item.added" })).toBe(false);

      // Missing required fields
      const invalidEvent = {
        type: "response.output_item.added",
        item: { id: "123" },
        // missing output_index and sequence_number
      };
      expect(isOutputItemAddedEvent(invalidEvent)).toBe(false);
    });

    it("should validate all required fields", () => {
      const partialEvent1 = {
        type: "response.output_item.added",
        item: {},
        output_index: 0,
        // missing sequence_number
      };
      expect(isOutputItemAddedEvent(partialEvent1)).toBe(false);

      const partialEvent2 = {
        type: "response.output_item.added",
        item: {},
        sequence_number: 1,
        // missing output_index
      };
      expect(isOutputItemAddedEvent(partialEvent2)).toBe(false);
    });
  });

  describe("isArgsDeltaEvent", () => {
    it("should return true for valid event", () => {
      const event = {
        type: "response.function_call_arguments.delta",
        delta: '{"key": "va',
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(event)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isArgsDeltaEvent({ type: "wrong" })).toBe(false);
      expect(isArgsDeltaEvent({ type: "response.function_call_arguments.delta" })).toBe(false);

      // Wrong type for delta
      const invalidDelta = {
        type: "response.function_call_arguments.delta",
        delta: 123, // should be string
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(invalidDelta)).toBe(false);
    });

    it("should validate all required fields", () => {
      const missingDelta = {
        type: "response.function_call_arguments.delta",
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(missingDelta)).toBe(false);

      const missingItemId = {
        type: "response.function_call_arguments.delta",
        delta: "text",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(missingItemId)).toBe(false);

      const missingOutputIndex = {
        type: "response.function_call_arguments.delta",
        delta: "text",
        item_id: "item-123",
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(missingOutputIndex)).toBe(false);

      const missingSequenceNumber = {
        type: "response.function_call_arguments.delta",
        delta: "text",
        item_id: "item-123",
        output_index: 0,
      };
      expect(isArgsDeltaEvent(missingSequenceNumber)).toBe(false);
    });
  });

  describe("isArgsDoneEvent", () => {
    it("should return true for valid event", () => {
      const event = {
        type: "response.function_call_arguments.done",
        arguments: '{"key": "value"}',
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDoneEvent(event)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isArgsDoneEvent({ type: "wrong" })).toBe(false);
      expect(isArgsDoneEvent({ type: "response.function_call_arguments.done" })).toBe(false);

      // Wrong type for arguments
      const invalidArgs = {
        type: "response.function_call_arguments.done",
        arguments: { key: "value" }, // should be string
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDoneEvent(invalidArgs)).toBe(false);
    });

    it("should validate all required fields", () => {
      const missingArguments = {
        type: "response.function_call_arguments.done",
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDoneEvent(missingArguments)).toBe(false);

      const missingItemId = {
        type: "response.function_call_arguments.done",
        arguments: "{}",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDoneEvent(missingItemId)).toBe(false);

      const missingSequenceNumber = {
        type: "response.function_call_arguments.done",
        arguments: "{}",
        item_id: "item-123",
        output_index: 0,
      };
      expect(isArgsDoneEvent(missingSequenceNumber)).toBe(false);
    });
  });

  describe("isOutputItemDoneEvent", () => {
    it("should return true for valid event", () => {
      // Create a valid ResponseFunctionToolCall
      const functionCall: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "call-123",
        call_id: "call-456",
        name: "test_function",
        arguments: '{"param": "value"}',
      };

      const event: Responses.ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: functionCall,
        output_index: 0,
        sequence_number: 1,
      };
      expect(isOutputItemDoneEvent(event)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isOutputItemDoneEvent({ type: "wrong" })).toBe(false);
      expect(isOutputItemDoneEvent({ type: "response.output_item.done" })).toBe(false);

      const missingSequenceNumber = {
        type: "response.output_item.done",
        item: {},
        output_index: 0,
      };
      expect(isOutputItemDoneEvent(missingSequenceNumber)).toBe(false);
    });
  });

  describe("extractOutputItem", () => {
    it("should extract properties from ResponseFunctionToolCall", () => {
      const item: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "call-123",
        call_id: "call-456",
        name: "test_func",
        arguments: '{"arg": "value"}',
      };
      const result = extractOutputItem(item);
      expect(result).toEqual({
        type: "function_call",
        id: "call-123",
        call_id: "call-456",
        name: "test_func",
        arguments: '{"arg": "value"}',
      });
    });

    it("should handle ResponseOutputMessage", () => {
      const message: Responses.ResponseOutputMessage = {
        type: "message",
        id: "msg-123",
        content: [],
        role: "assistant",
        status: "completed",
      };
      const result = extractOutputItem(message);
      expect(result).toEqual({ type: "message", id: "msg-123" });
    });

    it("should handle items with only some properties", () => {
      // Testing with a minimal valid ResponseOutputItem
      const minimalItem: Responses.ResponseFileSearchToolCall = {
        type: "file_search_call",
        id: "search-123",
        queries: ["test query"],
        status: "completed",
        results: [],
      };
      const result = extractOutputItem(minimalItem);
      expect(result).toEqual({
        type: "file_search_call",
        id: "search-123",
      });
    });
  });

  describe("isFunctionCallItem", () => {
    it("should return true for function call items", () => {
      const item: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "123",
        call_id: "456",
        name: "test",
        arguments: "{}",
      };
      expect(isFunctionCallItem(item)).toBe(true);

      // Type guard should narrow the type
      if (isFunctionCallItem(item)) {
        // This should compile without errors
        const name: string = item.name;
        const callId: string = item.call_id;
        const args: string = item.arguments;
        
        // Verify the values are actually accessible and correct
        expect(name).toBe("test");
        expect(callId).toBe("456");
        expect(args).toBe("{}");
      }
    });

    it("should return false for non-function call items", () => {
      const message: Responses.ResponseOutputMessage = {
        type: "message",
        id: "msg-123",
        content: [],
        role: "assistant",
        status: "completed",
      };
      expect(isFunctionCallItem(message)).toBe(false);

      const fileSearch: Responses.ResponseFileSearchToolCall = {
        type: "file_search_call",
        id: "search-123",
        queries: ["test query"],
        status: "completed",
        results: [],
      };
      expect(isFunctionCallItem(fileSearch)).toBe(false);
    });
  });

  describe("isTextDeltaEvent", () => {
    it("should return true for valid text delta event", () => {
      const event: Responses.ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "Hello",
        item_id: "item-123",
        output_index: 0,
        sequence_number: 1,
        logprobs: [],
      };
      expect(isTextDeltaEvent(event)).toBe(true);
    });

    it("should work with minimal valid event", () => {
      const minimalEvent = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "text",
        item_id: "id",
        output_index: 0,
      };
      expect(isTextDeltaEvent(minimalEvent)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isTextDeltaEvent({ type: "wrong" })).toBe(false);

      const missingContentIndex = {
        type: "response.output_text.delta",
        delta: "text",
        item_id: "id",
        output_index: 0,
      };
      expect(isTextDeltaEvent(missingContentIndex)).toBe(false);

      const wrongDeltaType = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: 123, // should be string
        item_id: "id",
        output_index: 0,
      };
      expect(isTextDeltaEvent(wrongDeltaType)).toBe(false);
    });
  });

  describe("isTextDoneEvent", () => {
    it("should return true for valid text done event", () => {
      const event: Responses.ResponseTextDoneEvent = {
        type: "response.output_text.done",
        content_index: 0,
        item_id: "item-123",
        text: "Hello, world!",
        output_index: 0,
        sequence_number: 1,
        logprobs: [],
      };
      expect(isTextDoneEvent(event)).toBe(true);
    });

    it("should work with minimal valid event", () => {
      const minimalEvent = {
        type: "response.output_text.done",
        content_index: 0,
        item_id: "id",
        text: "done text",
        output_index: 0,
      };
      expect(isTextDoneEvent(minimalEvent)).toBe(true);
    });

    it("should return false for invalid event", () => {
      expect(isTextDoneEvent({ type: "wrong" })).toBe(false);

      const missingText = {
        type: "response.output_text.done",
        content_index: 0,
        item_id: "id",
        output_index: 0,
      };
      expect(isTextDoneEvent(missingText)).toBe(false);

      const wrongTextType = {
        type: "response.output_text.done",
        content_index: 0,
        item_id: "id",
        text: null, // should be string
        output_index: 0,
      };
      expect(isTextDoneEvent(wrongTextType)).toBe(false);
    });
  });

  describe("type narrowing", () => {
    it("should properly narrow types after guards", () => {
      const unknownEvent: unknown = {
        type: "response.output_item.added",
        item: {
          type: "function_call",
          id: "123",
          call_id: "456",
          name: "test",
          arguments: "{}",
        },
        output_index: 0,
        sequence_number: 1,
      };

      if (isOutputItemAddedEvent(unknownEvent)) {
        // These should compile without errors due to type narrowing
        const item: Responses.ResponseOutputItem = unknownEvent.item;
        const index: number = unknownEvent.output_index;
        const seq: number = unknownEvent.sequence_number;
        
        // Verify the values are actually accessible and correct
        expect(item).toEqual({
          type: "function_call",
          id: "123",
          call_id: "456",
          name: "test",
          arguments: "{}",
        });
        expect(index).toBe(0);
        expect(seq).toBe(1);
      }

      const textEvent: unknown = {
        type: "response.output_text.delta",
        content_index: 0,
        delta: "text",
        item_id: "id",
        output_index: 0,
      };

      if (isTextDeltaEvent(textEvent)) {
        // These should compile without errors
        const delta: string = textEvent.delta;
        const itemId: string = textEvent.item_id;
        const contentIndex: number = textEvent.content_index;
        
        // Verify the values are actually accessible and correct
        expect(delta).toBe("text");
        expect(itemId).toBe("id");
        expect(contentIndex).toBe(0);
      }
    });
  });
});
