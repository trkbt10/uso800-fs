/**
 * @file Unit tests for LLM orchestrator with PersistAdapter
 */
import { createUsoFsLLMInstance, type OpenAIResponsesClient } from "./fs-llm";
import { createMemoryAdapter } from "../webdav/persist/memory";
import type { Responses } from "openai/resources/responses/responses";

describe("fs-llm with PersistAdapter", () => {
  describe("createUsoFsLLMInstance", () => {
    it("creates instance with valid inputs", () => {
      const mockClient = {
        responses: {
          stream: async () => {
            return (async function* (): AsyncGenerator<Responses.ResponseStreamEvent> {
              const delta: Responses.ResponseTextDeltaEvent = {
                type: "response.output_text.delta",
                content_index: 0,
                output_index: 0,
                sequence_number: 0,
                item_id: "msg1",
                delta: JSON.stringify({ folder: ["test"], entries: [{ name: "file.txt", kind: "file", content: "test", mime: "text/plain" }] }).slice(0, 20),
                logprobs: [],
              };
              const done: Responses.ResponseTextDoneEvent = {
                type: "response.output_text.done",
                content_index: 0,
                output_index: 0,
                sequence_number: 1,
                item_id: "msg1",
                text: JSON.stringify({ folder: ["test"], entries: [{ name: "file.txt", kind: "file", content: "test", mime: "text/plain" }] }),
                logprobs: [],
              };
              yield delta; yield done;
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
        const itemId = "call1";
        const added: Responses.ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          item: {
            type: "function_call",
            id: itemId,
            name: "emit_fs_listing",
            arguments: "{}",
            call_id: "c1",
          },
          output_index: 0,
          sequence_number: 0,
        };
        const argsDone: Responses.ResponseFunctionCallArgumentsDoneEvent = {
          type: "response.function_call_arguments.done",
          item_id: itemId,
          output_index: 0,
          sequence_number: 1,
          arguments: JSON.stringify({
            folder: ["test"],
            entries: [
              { name: "dir1", kind: "dir", content: "", mime: "" },
              { name: "file.txt", kind: "file", content: "content", mime: "text/plain" },
            ],
          }),
        };
        yield added; yield argsDone;
      })();

      const mockClient: OpenAIResponsesClient = { responses: { stream: async () => mockStream } };

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
        const itemId = "call1";
        const added: Responses.ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          item: { type: "function_call", id: itemId, name: "emit_file_content", arguments: "{}", call_id: "c1" },
          output_index: 0,
          sequence_number: 0,
        };
        const argsDone: Responses.ResponseFunctionCallArgumentsDoneEvent = {
          type: "response.function_call_arguments.done",
          item_id: itemId,
          output_index: 0,
          sequence_number: 1,
          arguments: JSON.stringify({ path: ["test.txt"], content: "Generated content", mime: "text/plain" }),
        };
        yield added; yield argsDone;
      })();

      const mockClient: OpenAIResponsesClient = { responses: { stream: async () => mockStream } };

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

      const instance = createUsoFsLLMInstance(mockClient, { 
        model: "test", 
        persist 
      });
      
      const result = await instance.fabricateFileContent(["test.txt"]);
      
      expect(result).toBe("");
    });
  });
});
