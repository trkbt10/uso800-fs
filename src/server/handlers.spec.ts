/**
 * @file Unit tests for WebDAV handlers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleGetRequest,
  handlePutRequest,
  handlePropfindRequest,
  handleMkcolRequest,
  createMkcolOnGenerate,
  type LlmLike,
} from "./handlers";
import { createMemoryAdapter } from "../persist/memory";
import type { WebDAVLogger } from "../logging/webdav-logger";

describe("WebDAV Handlers", () => {
  let persist: ReturnType<typeof createMemoryAdapter>;
  let logger: WebDAVLogger;
  let llm: LlmLike;
  
  beforeEach(() => {
    persist = createMemoryAdapter();
    logger = {
      logInput: vi.fn(),
      logOutput: vi.fn(),
      logOperation: vi.fn(),
      logRead: vi.fn(),
      logWrite: vi.fn(),
      logList: vi.fn(),
      logCreate: vi.fn(),
      logDelete: vi.fn(),
      logMove: vi.fn(),
      logCopy: vi.fn(),
    };
    llm = {
      fabricateListing: vi.fn().mockImplementation(async (path) => {
        // Simulate LLM creating the directory
        await persist.ensureDir(path);
      }),
      fabricateFileContent: vi.fn().mockResolvedValue("Generated content"),
    };
  });
  
  describe("handleGetRequest", () => {
    it("returns 404 for non-existent file without LLM", async () => {
      const result = await handleGetRequest("/test.txt", { persist, logger });
      
      expect(result.response.status).toBe(404);
      expect(logger.logRead).toHaveBeenCalledWith("/test.txt", 404);
    });
    
    it("generates content for non-existent file with LLM", async () => {
      const result = await handleGetRequest("/test.txt", { persist, llm, logger });
      
      expect(result.response.status).toBe(200);
      expect(result.sideEffects?.llmCalled).toBe(true);
      expect(result.sideEffects?.generated).toBe(true);
      expect(llm.fabricateFileContent).toHaveBeenCalledWith(["test.txt"]);
    });
    
    it("returns existing file content", async () => {
      await persist.writeFile(["existing.txt"], new TextEncoder().encode("Existing content"), "text/plain");
      
      const result = await handleGetRequest("/existing.txt", { persist, logger });
      
      expect(result.response.status).toBe(200);
      expect(result.response.body).toBeInstanceOf(Uint8Array);
      const content = new TextDecoder().decode(result.response.body as Uint8Array);
      expect(content).toBe("Existing content");
    });
    
    it("generates content for empty file with LLM", async () => {
      await persist.writeFile(["empty.txt"], new Uint8Array(0), "text/plain");
      
      const result = await handleGetRequest("/empty.txt", { persist, llm, logger });
      
      expect(result.response.status).toBe(200);
      expect(result.sideEffects?.llmCalled).toBe(true);
      expect(llm.fabricateFileContent).toHaveBeenCalledWith(["empty.txt"]);
    });
    
    it("CRITICAL: handles root path correctly", async () => {
      const result = await handleGetRequest("/", { persist, logger });
      
      // Root directory should exist and return HTML index
      expect(result.response.status).toBe(200);
      expect(result.response.headers?.["Content-Type"]).toBe("text/html");
    });
  });
  
  describe("handlePutRequest", () => {
    it("creates file with provided content", async () => {
      const content = new TextEncoder().encode("Test content");
      const result = await handlePutRequest("/new.txt", content, { persist, logger });
      
      expect(result.response.status).toBe(201);
      expect(await persist.exists(["new.txt"])).toBe(true);
      
      const stored = await persist.readFile(["new.txt"]);
      expect(new TextDecoder().decode(stored)).toBe("Test content");
    });
    
    it("generates content for empty PUT with LLM", async () => {
      const result = await handlePutRequest("/empty.txt", new Uint8Array(0), { persist, llm, logger });
      
      expect(result.response.status).toBe(201);
      expect(result.sideEffects?.llmCalled).toBe(true);
      expect(llm.fabricateFileContent).toHaveBeenCalledWith(["empty.txt"]);
      
      const stored = await persist.readFile(["empty.txt"]);
      expect(new TextDecoder().decode(stored)).toBe("Generated content");
    });
    
    it("creates empty file without LLM", async () => {
      const result = await handlePutRequest("/empty.txt", new Uint8Array(0), { persist, logger });
      
      expect(result.response.status).toBe(201);
      expect(result.sideEffects?.llmCalled).toBeUndefined();
      
      const stored = await persist.readFile(["empty.txt"]);
      expect(stored.byteLength).toBe(0);
    });
  });
  
  describe("handlePropfindRequest", () => {
    it("returns 404 for non-existent directory without LLM", async () => {
      const result = await handlePropfindRequest("/missing", "1", { persist, logger });
      
      expect(result.response.status).toBe(404);
      expect(logger.logList).toHaveBeenCalledWith("/missing", 404);
    });
    
    it("generates listing for non-existent directory with LLM", async () => {
      const result = await handlePropfindRequest("/new-dir", "1", { persist, llm, logger });
      
      expect(result.response.status).toBe(207); // Multi-status for PROPFIND
      expect(result.sideEffects?.llmCalled).toBe(true);
      expect(llm.fabricateListing).toHaveBeenCalledWith(["new-dir"], { depth: "1" });
    });
    
    it("returns existing directory listing", async () => {
      await persist.ensureDir(["existing-dir"]);
      await persist.writeFile(["existing-dir", "file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const result = await handlePropfindRequest("/existing-dir", "1", { persist, logger });
      
      expect(result.response.status).toBe(207); // Multi-status
      expect(result.response.headers?.["Content-Type"]).toContain("application/xml");
    });
    
    it("generates listing for empty directory with LLM", async () => {
      await persist.ensureDir(["empty-dir"]);
      
      const result = await handlePropfindRequest("/empty-dir", "1", { persist, llm, logger });
      
      expect(result.sideEffects?.llmCalled).toBe(true);
      expect(llm.fabricateListing).toHaveBeenCalledWith(["empty-dir"], { depth: "1" });
    });
    
    it("CRITICAL: handles root path correctly", async () => {
      const result = await handlePropfindRequest("/", "1", { persist, logger });
      
      expect(result.response.status).toBe(207);
      // Should NOT try to access ["root"]
      expect(llm.fabricateListing).not.toHaveBeenCalledWith(["root"], expect.anything());
    });
  });
  
  describe("handleMkcolRequest", () => {
    it("creates directory", async () => {
      const result = await handleMkcolRequest("/new-folder", { persist, logger });
      
      expect(result.response.status).toBe(201);
      expect(await persist.exists(["new-folder"])).toBe(true);
      
      const stat = await persist.stat(["new-folder"]);
      expect(stat.type).toBe("dir");
    });
    
    it("calls onGenerate callback after creation", async () => {
      const onGenerate = vi.fn();
      await handleMkcolRequest("/with-callback", { persist, logger, onGenerate });
      
      expect(onGenerate).toHaveBeenCalledWith(["with-callback"]);
    });
    
    it("returns 409 if parent doesn't exist", async () => {
      const result = await handleMkcolRequest("/parent/child", { persist, logger });
      
      expect(result.response.status).toBe(409); // Conflict
    });
  });
  
  describe("createMkcolOnGenerate", () => {
    it("returns undefined without LLM", () => {
      const callback = createMkcolOnGenerate(undefined);
      expect(callback).toBeUndefined();
    });
    
    it("creates callback that uses LLM", async () => {
      const callback = createMkcolOnGenerate(llm);
      expect(callback).toBeDefined();
      
      await callback!(["test-dir"]);
      expect(llm.fabricateListing).toHaveBeenCalledWith(["test-dir"]);
    });
    
    it("callback handles LLM errors gracefully", async () => {
      const failingLlm: LlmLike = {
        fabricateListing: vi.fn().mockRejectedValue(new Error("LLM error")),
        fabricateFileContent: vi.fn(),
      };
      
      const callback = createMkcolOnGenerate(failingLlm);
      await expect(callback!(["test"])).resolves.toBeUndefined();
    });
  });
  
  describe("Path resolution", () => {
    it("CRITICAL: never creates 'root' folder for root path in GET", async () => {
      await handleGetRequest("/", { persist, llm, logger });
      
      const contents = await persist.readdir([]);
      expect(contents).not.toContain("root");
    });
    
    it("CRITICAL: never creates 'root' folder for root path in PROPFIND", async () => {
      await handlePropfindRequest("/", "1", { persist, llm, logger });
      
      const contents = await persist.readdir([]);
      expect(contents).not.toContain("root");
      
      // LLM should be called with empty array for root
      if (llm.fabricateListing) {
        const calls = (llm.fabricateListing as any).mock.calls;
        const rootCalls = calls.filter((call: any[]) => call[0].length === 0);
        if (rootCalls.length > 0) {
          expect(rootCalls[0][0]).toEqual([]);
        }
      }
    });
    
    it("handles nested paths correctly", async () => {
      await handlePutRequest("/foo/bar/baz.txt", new TextEncoder().encode("test"), { persist, logger });
      
      expect(await persist.exists(["foo", "bar", "baz.txt"])).toBe(true);
      expect(await persist.exists(["foo", "bar"])).toBe(true);
      expect(await persist.exists(["foo"])).toBe(true);
    });
  });
});