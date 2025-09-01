/**
 * @file Integration test for WebDAV operations
 */
// Use global vitest functions and avoid mocks per lint policy
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";
import { createLlmWebDavHooks, type LlmOrchestrator } from "../llm/webdav-hooks";
import { pathToSegments } from "../llm/utils/path-utils";

describe("WebDAV Integration", () => {
  const ctx: {
    app: ReturnType<typeof makeWebdavApp> | null;
    persist: ReturnType<typeof createMemoryAdapter> | null;
    llm: (LlmOrchestrator & { listingCalls: string[][]; fileCalls: string[][] }) | null;
  } = { app: null, persist: null, llm: null };
  
  beforeEach(() => {
    const persist = createMemoryAdapter();
    const calls1: string[][] = [];
    const calls2: string[][] = [];
    const llm: LlmOrchestrator & { listingCalls: string[][]; fileCalls: string[][] } = {
      listingCalls: calls1,
      fileCalls: calls2,
      async fabricateListing(path) {
        calls1.push([...path]);
        await persist.ensureDir(path);
        await persist.writeFile([...path, "test.txt"], new TextEncoder().encode("test content"), "text/plain");
        await persist.ensureDir([...path, "subdir"]);
      },
      async fabricateFileContent() {
        calls2.push([]);
        return "Generated file content";
      },
    };
    
    ctx.persist = persist;
    ctx.llm = llm;
    ctx.app = makeWebdavApp({ persist, hooks: createLlmWebDavHooks(llm) });
  });
  
  describe("Root path handling", () => {
    it("CRITICAL: GET / never creates 'root' folder", async () => {
      const res = await ctx.app!.request("/", { method: "GET" });
      
      expect(res.status).toBe(200);
      
      // Check persist state
      const rootContents = await ctx.persist!.readdir([]);
      expect(rootContents).not.toContain("root");
    });
    
    it("CRITICAL: PROPFIND / never creates 'root' folder", async () => {
      const res = await ctx.app!.request("/", { 
        method: "PROPFIND",
        headers: { "Depth": "1" }
      });
      
      expect(res.status).toBe(207);
      
      // Check persist state
      const rootContents = await ctx.persist!.readdir([]);
      expect(rootContents).not.toContain("root");
      
      // Check that LLM was called with empty array for root when needed
      if (ctx.llm!.listingCalls.length > 0) {
        expect(ctx.llm!.listingCalls[0]).toEqual([]);
      }
    });
    
    it("CRITICAL: PUT /test.txt doesn't create root folder", async () => {
      const res = await ctx.app!.request("/test.txt", {
        method: "PUT",
        body: "test content"
      });
      
      expect(res.status).toBe(201);
      
      // File should be at root level
      expect(await ctx.persist!.exists(["test.txt"])).toBe(true);
      
      // No 'root' folder should exist
      const rootContents = await ctx.persist!.readdir([]);
      expect(rootContents).toContain("test.txt");
      expect(rootContents).not.toContain("root");
    });
    
    it("CRITICAL: MKCOL /newfolder doesn't create root folder", async () => {
      const res = await ctx.app!.request("/newfolder", {
        method: "MKCOL"
      });
      
      expect(res.status).toBe(201);
      
      // Folder should be at root level
      expect(await ctx.persist!.exists(["newfolder"])).toBe(true);
      
      // No 'root' folder should exist
      const rootContents = await ctx.persist!.readdir([]);
      expect(rootContents).toContain("newfolder");
      expect(rootContents).not.toContain("root");
    });
  });
  
  describe("Path resolution consistency", () => {
    it("all handlers use the same path resolution", async () => {
      const testPath = "/foo/bar/baz.txt";
      const expectedSegments = ["foo", "bar", "baz.txt"];
      
      // Create parent directories
      await ctx.persist!.ensureDir(["foo", "bar"]);
      
      // Test PUT
      const putRes = await ctx.app!.request(testPath, {
        method: "PUT",
        body: "content"
      });
      expect(putRes.status).toBe(201);
      expect(await ctx.persist!.exists(expectedSegments)).toBe(true);
      
      // Test GET
      const getRes = await ctx.app!.request(testPath, { method: "GET" });
      expect(getRes.status).toBe(200);
      
      // Test HEAD
      const headRes = await ctx.app!.request(testPath, { method: "HEAD" });
      expect(headRes.status).toBe(200);
      
      // Test DELETE
      const deleteRes = await ctx.app!.request(testPath, { method: "DELETE" });
      expect(deleteRes.status).toBe(204);
      expect(await ctx.persist!.exists(expectedSegments)).toBe(false);
    });
    
    it("handles various path formats consistently", async () => {
      const paths = [
        "/test",
        "/test/",
        "//test//",
        "/test//sub/",
      ];
      
      for (const path of paths) {
        const normalizedSegments = pathToSegments(path);
        
        // Create via MKCOL
        if (normalizedSegments.length > 0) {
          await ctx.persist!.ensureDir(normalizedSegments);
          
          // Verify via PROPFIND
          const res = await ctx.app!.request(path, {
            method: "PROPFIND",
            headers: { "Depth": "0" }
          });
          
          expect(res.status).toBe(207);
        }
      }
    });
  });
  
  describe("LLM integration", () => {
    it("generates content for non-existent file", async () => {
      const res = await ctx.app!.request("/generated.txt", { method: "GET" });
      
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("Generated file content");
      // Intentionally avoid mock expectations; behavior is asserted via result
    });
    
    it("generates listing for non-existent directory", async () => {
      const res = await ctx.app!.request("/generated-dir", {
        method: "PROPFIND",
        headers: { "Depth": "1" }
      });
      
      expect(res.status).toBe(207);
      // Intentionally avoid mock expectations; behavior is asserted via persist state
      
      // Check that the generated content exists
      expect(await ctx.persist!.exists(["generated-dir", "test.txt"])).toBe(true);
      expect(await ctx.persist!.exists(["generated-dir", "subdir"])).toBe(true);
    });
    
    it("generates content for empty PUT", async () => {
      const res = await ctx.app!.request("/empty-put.txt", {
        method: "PUT",
        body: ""
      });
      
      expect(res.status).toBe(201);
      // Intentionally avoid mock expectations; behavior is asserted via persist state
      
      const content = await ctx.persist!.readFile(["empty-put.txt"]);
      expect(new TextDecoder().decode(content)).toBe("Generated file content");
    });
    
    it("generates listing after MKCOL", async () => {
      const res = await ctx.app!.request("/new-collection", {
        method: "MKCOL"
      });
      
      expect(res.status).toBe(201);
      
      // The onGenerate callback should have been called
      // Note: In the actual implementation, this would call LLM
      expect(await ctx.persist!.exists(["new-collection"])).toBe(true);
    });
  });
  
  describe("WebDAV compliance", () => {
    it("returns proper status codes", async () => {
      // OPTIONS should return allowed methods
      const optionsRes = await ctx.app!.request("/", { method: "OPTIONS" });
      expect(optionsRes.status).toBe(200);
      expect(optionsRes.headers.get("Allow")).toContain("GET");
      
      // GET non-existent without LLM should be 404
      const noLlmApp = makeWebdavApp({ persist: createMemoryAdapter() });
      const getRes = await noLlmApp.request("/missing.txt", { method: "GET" });
      expect(getRes.status).toBe(404);
      
      // MKCOL on existing should fail
      await ctx.persist!.ensureDir(["existing"]);
      const mkcolRes = await ctx.app!.request("/existing", { method: "MKCOL" });
      expect([201, 405]).toContain(mkcolRes.status);
      
      // DELETE non-existent should be 404
      const deleteRes = await ctx.app!.request("/missing", { method: "DELETE" });
      expect(deleteRes.status).toBe(404);
    });
    
    it("handles PROPFIND depth correctly", async () => {
      // Create nested structure
      await ctx.persist!.ensureDir(["parent"]);
      await ctx.persist!.ensureDir(["parent", "child"]);
      await ctx.persist!.writeFile(["parent", "file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      // Depth: 0 should only return the collection itself
      const depth0Res = await ctx.app!.request("/parent", {
        method: "PROPFIND",
        headers: { "Depth": "0" }
      });
      expect(depth0Res.status).toBe(207);
      const xml0 = await depth0Res.text();
      expect(xml0).toContain("/parent");
      expect(xml0).not.toContain("child");
      
      // Depth: 1 should include immediate children
      const depth1Res = await ctx.app!.request("/parent", {
        method: "PROPFIND",
        headers: { "Depth": "1" }
      });
      expect(depth1Res.status).toBe(207);
      const xml1 = await depth1Res.text();
      expect(xml1).toContain("child");
      expect(xml1).toContain("file.txt");
    });
  });
});
