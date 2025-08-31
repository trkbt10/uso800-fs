/**
 * @file Unit tests for LLM orchestrator with PersistAdapter
 */
import { createUsoFsLLMInstance } from "./fs-llm";
import { createMemoryAdapter } from "../persist/memory";
import type { PersistAdapter } from "../persist/types";

describe("fs-llm with PersistAdapter", () => {
  describe("createUsoFsLLMInstance", () => {
    it("requires client with responses.stream", () => {
      expect(() =>
        createUsoFsLLMInstance({} as any, { model: "test", persist: createMemoryAdapter() }),
      ).toThrow("client.responses.stream is required");
    });

    it("requires model and persist", () => {
      const mockClient = {
        responses: { stream: () => {} },
      };
      expect(() => createUsoFsLLMInstance(mockClient as any, {} as any)).toThrow("model and persist are required");
    });

    it("creates instance with valid inputs", () => {
      const mockClient = {
        responses: { 
          stream: async () => {
            return (async function* () {
              yield {
                type: "response.function_call_arguments.done",
                item_id: "test",
                arguments: JSON.stringify({
                  path: "/test",
                  entries: [
                    { name: "file.txt", type: "file", content: "test" }
                  ]
                })
              };
            })();
          }
        },
      };
      const persist = createMemoryAdapter();
      const instance = createUsoFsLLMInstance(mockClient as any, { 
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
      const mockStream = (async function* () {
        yield {
          type: "response.output_item.added",
          item: { type: "function_call", id: "test", name: "emit_fs_listing" }
        };
        yield {
          type: "response.function_call_arguments.delta",
          item_id: "test",
          delta: JSON.stringify({
            path: "/test",
            entries: [
              { name: "dir1", type: "dir" },
              { name: "file.txt", type: "file", content: "content" }
            ]
          })
        };
        yield {
          type: "response.function_call_arguments.done",
          item_id: "test",
          arguments: JSON.stringify({
            path: "/test",
            entries: [
              { name: "dir1", type: "dir" },
              { name: "file.txt", type: "file", content: "content" }
            ]
          })
        };
      })();

      const mockClient = {
        responses: { stream: async () => mockStream },
      };

      const instance = createUsoFsLLMInstance(mockClient as any, { 
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
      const mockStream = (async function* () {
        yield {
          type: "response.output_item.added",
          item: { type: "function_call", id: "test", name: "emit_file_content" }
        };
        yield {
          type: "response.function_call_arguments.delta",
          item_id: "test",
          delta: JSON.stringify({
            path: "/test.txt",
            content: "Generated content"
          })
        };
        yield {
          type: "response.function_call_arguments.done",
          item_id: "test",
          arguments: JSON.stringify({
            path: "/test.txt",
            content: "Generated content"
          })
        };
      })();

      const mockClient = {
        responses: { stream: async () => mockStream },
      };

      const instance = createUsoFsLLMInstance(mockClient as any, { 
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

      const mockClient = {
        responses: { stream: async () => mockStream },
      };

      const instance = createUsoFsLLMInstance(mockClient as any, { 
        model: "test", 
        persist 
      });
      
      const result = await instance.fabricateFileContent(["test.txt"]);
      
      expect(result).toBe("");
    });
  });
});