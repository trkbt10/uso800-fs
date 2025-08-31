/**
 * @file Unit tests for LLM orchestrator with PersistAdapter
 */
import { createUsoFsLLMInstance } from "./fs-llm";
import { createMemoryAdapter } from "../webdav/persist/memory";
import type { Responses } from "openai/resources/responses/responses";

describe("fs-llm with PersistAdapter", () => {
  describe("createUsoFsLLMInstance", () => {
    it("creates instance with valid inputs", () => {
      const mockClient = {
        responses: { 
          stream: async () => {
            return (async function* (): AsyncGenerator<Responses.ResponseStreamEvent> {
              const ev: Responses.ResponseFunctionCallArgumentsDoneEvent = {
                type: "response.function_call_arguments.done",
                item_id: "test",
                output_index: 0,
                sequence_number: 0,
                arguments: JSON.stringify({
                  folder: ["test"],
                  entries: [
                    { name: "file.txt", kind: "file", content: "test", mime: "text/plain" }
                  ]
                })
              };
              yield ev;
            })();
          }
        },
      };
      const persist = createMemoryAdapter();
      const instance = createUsoFsLLMInstance(mockClient, { 
        model: "test", 
        persist 
      });
      
      expect(instance).toHaveProperty("fabricateListing");
      expect(instance).toHaveProperty("fabricateFileContent");
    });
  });

  describe("fabricateListing", () => {
    it("creates directories and files via PersistAdapter", async () => {
      const persist = createMemoryAdapter();
      const mockStream = (async function* (): AsyncGenerator<Responses.ResponseStreamEvent> {
        const added: Responses.ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          item: { type: "function_call", id: "test", name: "emit_fs_listing", arguments: "", call_id: "c1" },
          output_index: 0,
          sequence_number: 0,
        };
        const delta: Responses.ResponseFunctionCallArgumentsDeltaEvent = {
          type: "response.function_call_arguments.delta",
          item_id: "test",
          output_index: 0,
          sequence_number: 1,
          delta: JSON.stringify({
            folder: ["test"],
            entries: [
              { name: "dir1", kind: "dir", content: "", mime: "" },
              { name: "file.txt", kind: "file", content: "content", mime: "text/plain" }
            ]
          })
        };
        const done: Responses.ResponseFunctionCallArgumentsDoneEvent = {
          type: "response.function_call_arguments.done",
          item_id: "test",
          output_index: 0,
          sequence_number: 2,
          arguments: JSON.stringify({
            folder: ["test"],
            entries: [
              { name: "dir1", kind: "dir", content: "", mime: "" },
              { name: "file.txt", kind: "file", content: "content", mime: "text/plain" }
            ]
          })
        };
        const finished: Responses.ResponseOutputItemDoneEvent = {
          type: "response.output_item.done",
          item: { type: "function_call", id: "test", name: "emit_fs_listing", call_id: "c1", arguments: JSON.stringify({
            folder: ["test"],
            entries: [
              { name: "dir1", kind: "dir", content: "", mime: "" },
              { name: "file.txt", kind: "file", content: "content", mime: "text/plain" }
            ]
          }) },
          output_index: 0,
          sequence_number: 3,
        };
        yield added; yield delta; yield done; yield finished;
      })();

      const mockClient = { responses: { stream: async () => mockStream } };

      const instance = createUsoFsLLMInstance(mockClient, { 
        model: "test", 
        persist 
      });
      
      await instance.fabricateListing(["test"]);
      
      // Verify created entries
      expect(await persist.exists(["test", "dir1"])).toBe(true);
      expect(await persist.exists(["test", "file.txt"])).toBe(true);
      
      const content = await persist.readFile(["test", "file.txt"]);
      expect(new TextDecoder().decode(content)).toBe("content");
    });
  });

  describe("fabricateFileContent", () => {
    it("creates file with content via PersistAdapter", async () => {
      const persist = createMemoryAdapter();
      const mockStream = (async function* (): AsyncGenerator<Responses.ResponseStreamEvent> {
        const added: Responses.ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          item: { type: "function_call", id: "test", name: "emit_file_content", arguments: "", call_id: "c1" },
          output_index: 0,
          sequence_number: 0,
        };
        const delta: Responses.ResponseFunctionCallArgumentsDeltaEvent = {
          type: "response.function_call_arguments.delta",
          item_id: "test",
          output_index: 0,
          sequence_number: 1,
          delta: JSON.stringify({
            path: ["test.txt"],
            content: "Generated content",
            mime: "text/plain"
          })
        };
        const done: Responses.ResponseFunctionCallArgumentsDoneEvent = {
          type: "response.function_call_arguments.done",
          item_id: "test",
          output_index: 0,
          sequence_number: 2,
          arguments: JSON.stringify({
            path: ["test.txt"],
            content: "Generated content",
            mime: "text/plain"
          })
        };
        const finished: Responses.ResponseOutputItemDoneEvent = {
          type: "response.output_item.done",
          item: { type: "function_call", id: "test", name: "emit_file_content", call_id: "c1", arguments: JSON.stringify({
            path: ["test.txt"],
            content: "Generated content",
            mime: "text/plain"
          }) },
          output_index: 0,
          sequence_number: 3,
        };
        yield added; yield delta; yield done; yield finished;
      })();

      const mockClient = { responses: { stream: async () => mockStream } };

      const instance = createUsoFsLLMInstance(mockClient, { 
        model: "test", 
        persist 
      });
      
      const result = await instance.fabricateFileContent(["test.txt"]);
      
      expect(result).toBe("Generated content");
      expect(await persist.exists(["test.txt"])).toBe(true);
      
      const content = await persist.readFile(["test.txt"]);
      expect(new TextDecoder().decode(content)).toBe("Generated content");
    });

    it("returns empty string when no content generated", async () => {
      const persist = createMemoryAdapter();
      const mockStream = (async function* () {
        // Empty stream
      })();

      const mockClient = { responses: { stream: async () => mockStream } };

      const instance = createUsoFsLLMInstance(mockClient as any, { 
        model: "test", 
        persist 
      });
      
      const result = await instance.fabricateFileContent(["test.txt"]);
      
      expect(result).toBe("");
    });
  });
});
