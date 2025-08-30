/**
 * @file Unit tests for function-call related guards.
 */
import type { Responses } from "openai/resources/responses/responses";
import { extractOutputItem, isArgsDeltaEvent, isArgsDoneEvent, isFunctionCallItem } from "./function-call";

describe("Function call guards", () => {
  describe("isArgsDeltaEvent / isArgsDoneEvent", () => {
    it("accept valid delta/done shapes", () => {
      const deltaEv = {
        type: "response.function_call_arguments.delta",
        delta: "{}",
        item_id: "id123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDeltaEvent(deltaEv)).toBe(true);

      const doneEv = {
        type: "response.function_call_arguments.done",
        arguments: "{}",
        item_id: "id123",
        output_index: 0,
        sequence_number: 1,
      };
      expect(isArgsDoneEvent(doneEv)).toBe(true);
    });
  });

  describe("isFunctionCallItem", () => {
    it("returns true for function call items", () => {
      const item: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        name: "f",
        arguments: "{}",
        call_id: "c1",
        id: "i1",
      };
      expect(isFunctionCallItem(item)).toBe(true);
    });

    it("returns false for other item types", () => {
      const message: Responses.ResponseOutputMessage = {
        type: "message",
        id: "m1",
        content: [],
        role: "assistant",
        status: "completed",
      };
      // ResponseOutputMessage is part of the union; no cast needed
      expect(isFunctionCallItem(message)).toBe(false);
    });
  });

  describe("extractOutputItem", () => {
    it("extracts function call fields", () => {
      const item: Responses.ResponseFunctionToolCall = {
        type: "function_call",
        id: "123",
        name: "test_func",
        arguments: "{}",
        call_id: "call_456",
      };
      const result = extractOutputItem(item);
      expect(result.id).toBe("123");
      expect(result.type).toBe("function_call");
      expect(result.name).toBe("test_func");
      expect(result.arguments).toBe("{}");
      expect(result.call_id).toBe("call_456");
    });

    it("handles non-function items", () => {
      const message: Responses.ResponseOutputMessage = {
        type: "message",
        id: "msg-789",
        content: [],
        role: "assistant",
        status: "in_progress",
      };
      const result = extractOutputItem(message);
      expect(result.id).toBe("msg-789");
      expect(result.type).toBe("message");
      expect(result.name).toBeUndefined();
      expect(result.arguments).toBeUndefined();
    });
  });
});
