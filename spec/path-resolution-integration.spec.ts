/**
 * @file Integration test for path resolution across the system
 */
import { createMemoryAdapter } from "../src/webdav/persist/memory";
import { pathToSegments } from "../src/llm/utils/path-utils";
import { buildListingPrompt, buildFileContentPrompt } from "../src/llm/utils/prompt-builder";

describe("Path Resolution Integration", () => {
  describe("Root path handling", () => {
    it("CRITICAL: never creates 'root' folder for root path", async () => {
      const persist = createMemoryAdapter();
      
      // Simulate what server.ts does with root path
      const urlPath = "/";
      const segments = pathToSegments(urlPath);
      
      expect(segments).toEqual([]);
      expect(segments).not.toContain("root");
      
      // Ensure persist operations work correctly
      await persist.ensureDir(segments);
      const exists = await persist.exists(segments);
      expect(exists).toBe(true);
      
      // Root should not have a 'root' subdirectory
      const rootContents = await persist.readdir(segments);
      expect(rootContents).not.toContain("root");
    });
    
    it("LLM prompt for root path instructs to use empty array", () => {
      const segments = pathToSegments("/");
      const result = buildListingPrompt(segments);
      
      // Check the prompt contains clear instructions
      expect(result.prompt).toContain("use empty array [] for folder parameter");
      expect(result.folderParam).toEqual([]);
      expect(result.displayPath).toBe("/");
    });
    
    it("nested paths work correctly", async () => {
      const persist = createMemoryAdapter();
      
      // Test nested path
      const urlPath = "/foo/bar/baz";
      const segments = pathToSegments(urlPath);
      
      expect(segments).toEqual(["foo", "bar", "baz"]);
      
      await persist.ensureDir(segments);
      const exists = await persist.exists(segments);
      expect(exists).toBe(true);
      
      // Parent should contain the child
      const parentContents = await persist.readdir(["foo", "bar"]);
      expect(parentContents).toContain("baz");
    });
  });
  
  describe("WebDAV path normalization", () => {
    it("handles various WebDAV path formats", () => {
      // All these should result in root
      expect(pathToSegments("/")).toEqual([]);
      expect(pathToSegments("")).toEqual([]);
      expect(pathToSegments("//")).toEqual([]);
      
      // All these should result in ["foo"]
      expect(pathToSegments("/foo")).toEqual(["foo"]);
      expect(pathToSegments("/foo/")).toEqual(["foo"]);
      expect(pathToSegments("//foo//")).toEqual(["foo"]);
      
      // Nested paths
      expect(pathToSegments("/a/b/c")).toEqual(["a", "b", "c"]);
      expect(pathToSegments("/a//b///c/")).toEqual(["a", "b", "c"]);
    });
  });
  
  describe("Prompt generation for different paths", () => {
    it("generates different prompts for root vs nested", () => {
      const rootPrompt = buildListingPrompt([]);
      const nestedPrompt = buildListingPrompt(["docs", "api"]);
      
      // Root should have special note
      expect(rootPrompt.prompt).toContain("This is the root folder");
      expect(nestedPrompt.prompt).not.toContain("This is the root folder");
      
      // Both should have proper folder arrays
      expect(rootPrompt.prompt).toContain('"folder_array":[]');
      expect(nestedPrompt.prompt).toContain('"folder_array":["docs","api"]');
    });
    
    it("file content prompts include proper path info", () => {
      const filePrompt = buildFileContentPrompt(["src", "index.js"]);
      
      expect(filePrompt.pathParam).toEqual(["src", "index.js"]);
      expect(filePrompt.displayPath).toBe("/src/index.js");
      expect(filePrompt.prompt).toContain('"filename":"index.js"');
    });
  });
});
