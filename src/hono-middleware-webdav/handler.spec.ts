/**
 * @file Tests for WebDAV handlers using PersistAdapter.
 */
import { createMemoryAdapter } from "../persist/memory";
import {
  handleOptions,
  handlePropfind,
  handleMkcol,
  handleGet,
  handleHead,
  handlePut,
  handleDelete,
  handleMove,
  handleCopy,
} from "./handler";

describe("WebDAV Handlers with PersistAdapter", () => {
  describe("handleOptions", () => {
    it("returns DAV headers", () => {
      const res = handleOptions();
      expect(res.status).toBe(200);
      expect(res.headers).toMatchObject({
        DAV: "1,2",
        Allow: expect.stringContaining("OPTIONS"),
      });
    });
  });

  describe("handlePropfind", () => {
    it("returns 404 for non-existent path", async () => {
      const persist = createMemoryAdapter();
      const res = await handlePropfind(persist, "/nonexistent", null);
      expect(res.status).toBe(404);
    });

    it("returns multistatus for root", async () => {
      const persist = createMemoryAdapter();
      await persist.ensureDir(["test"]);
      await persist.writeFile(["file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const res = await handlePropfind(persist, "/", "1");
      expect(res.status).toBe(207);
      expect(res.body).toContain("multistatus");
      
      const res0 = await handlePropfind(persist, "/", "0");
      expect(res0.body).toContain("multistatus");
    });
  });

  describe("handleMkcol", () => {
    it("creates directory", async () => {
      const persist = createMemoryAdapter();
      const res = await handleMkcol(persist, "/newdir");
      expect(res.status).toBe(201);
      
      const exists = await persist.exists(["newdir"]);
      expect(exists).toBe(true);
    });
  });

  describe("handleGet", () => {
    it("returns 404 for missing file", async () => {
      const persist = createMemoryAdapter();
      const res = await handleGet(persist, "/missing.txt");
      expect(res.status).toBe(404);
    });

    it("returns file content", async () => {
      const persist = createMemoryAdapter();
      const content = "Hello World";
      await persist.writeFile(["test.txt"], new TextEncoder().encode(content), "text/plain");
      
      const res = await handleGet(persist, "/test.txt");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(new TextEncoder().encode(content));
    });

    it("returns HTML index for directory", async () => {
      const persist = createMemoryAdapter();
      await persist.ensureDir(["dir"]);
      await persist.writeFile(["dir", "file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const res = await handleGet(persist, "/dir");
      expect(res.status).toBe(200);
      expect(res.headers?.["Content-Type"]).toBe("text/html");
    });
  });

  describe("handleHead", () => {
    it("returns headers without body", async () => {
      const persist = createMemoryAdapter();
      await persist.writeFile(["file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const res = await handleHead(persist, "/file.txt");
      expect(res.status).toBe(200);
      expect(res.headers?.["Content-Length"]).toBe("7");
      expect(res.body).toBeUndefined();
    });
  });

  describe("handlePut", () => {
    it("creates file with content", async () => {
      const persist = createMemoryAdapter();
      const content = "New content";
      
      const res = await handlePut(persist, "/new.txt", content, "text/plain");
      expect(res.status).toBe(201);
      
      const data = await persist.readFile(["new.txt"]);
      expect(new TextDecoder().decode(data)).toBe(content);
    });
  });

  describe("handleDelete", () => {
    it("deletes existing file", async () => {
      const persist = createMemoryAdapter();
      await persist.writeFile(["file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const res = await handleDelete(persist, "/file.txt");
      expect(res.status).toBe(204);
      
      const exists = await persist.exists(["file.txt"]);
      expect(exists).toBe(false);
    });

    it("returns 404 for non-existent file", async () => {
      const persist = createMemoryAdapter();
      const res = await handleDelete(persist, "/missing.txt");
      expect(res.status).toBe(404);
    });
  });

  describe("handleMove", () => {
    it("moves file to new location", async () => {
      const persist = createMemoryAdapter();
      await persist.writeFile(["old.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const res = await handleMove(persist, "/old.txt", "/new.txt");
      expect(res.status).toBe(201);
      
      const oldExists = await persist.exists(["old.txt"]);
      const newExists = await persist.exists(["new.txt"]);
      expect(oldExists).toBe(false);
      expect(newExists).toBe(true);
    });
  });

  describe("handleCopy", () => {
    it("copies file to new location", async () => {
      const persist = createMemoryAdapter();
      const content = "content";
      await persist.writeFile(["source.txt"], new TextEncoder().encode(content), "text/plain");
      
      const res = await handleCopy(persist, "/source.txt", "/dest.txt");
      expect(res.status).toBe(201);
      
      const sourceExists = await persist.exists(["source.txt"]);
      const destExists = await persist.exists(["dest.txt"]);
      expect(sourceExists).toBe(true);
      expect(destExists).toBe(true);
      
      const destContent = await persist.readFile(["dest.txt"]);
      expect(new TextDecoder().decode(destContent)).toBe(content);
    });
  });
});