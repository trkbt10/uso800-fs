/**
 * @file E2E test for WebDAV middleware functionality
 * Tests the complete WebDAV server implementation including PROPFIND, GET, MKCOL operations
 */

// Use global describe/it/expect injected by test runner
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";

describe("WebDAV Middleware E2E", () => {
  // No hooks to keep middleware behavior pure
  // Use Hono's standard Request/Response without starting a server
  const persist = createMemoryAdapter();
  const app = makeWebdavApp({ persist });

  afterAll(() => {});

  describe("OPTIONS method", () => {
    it("returns WebDAV capabilities", async () => {
      const req = new Request("http://localhost/", { method: "OPTIONS" });
      const res = await app.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("DAV")).toBe("1,2");
      expect(res.headers.get("Allow")).toContain("OPTIONS");
      expect(res.headers.get("Allow")).toContain("PROPFIND");
      expect(res.headers.get("Allow")).toContain("MKCOL");
    });
  });

  describe("PROPFIND method", () => {
    it("lists root directory with depth 0", async () => {
      const req = new Request("http://localhost/", {
        method: "PROPFIND",
        headers: { Depth: "0" },
      });
      const res = await app.request(req);

      expect(res.status).toBe(207); // Multi-Status
      const body = await res.text();
      expect(body).toContain("<?xml");
      expect(body).toContain("multistatus");
      expect(body).toContain("<D:collection/>");
    });

    it("lists root directory with depth 1", async () => {
      const req = new Request("http://localhost/", {
        method: "PROPFIND",
        headers: { Depth: "1" },
      });
      const res = await app.request(req);

      expect(res.status).toBe(207);
      const body = await res.text();
      expect(body).toContain("multistatus");
    });
  });

  describe("MKCOL method", () => {
    it("creates a new directory", async () => {
      const persist2 = createMemoryAdapter();
      const app2 = makeWebdavApp({ persist: persist2 });

      const req = new Request("http://localhost/newdir", {
        method: "MKCOL",
      });
      const res = await app2.request(req);

      expect(res.status).toBe(201); // Created

      // Verify the directory was created
      const verifyReq = new Request("http://localhost/newdir", {
        method: "PROPFIND",
        headers: { Depth: "0" },
      });
      const verifyRes = await app2.request(verifyReq);
      expect(verifyRes.status).toBe(207);

      const body = await verifyRes.text();
      expect(body).toContain("<D:collection/>");
    });

    it("rejects root directory creation", async () => {
      const req = new Request("http://localhost/", {
        method: "MKCOL",
      });
      const res = await app.request(req);

      expect(res.status).toBe(403); // Forbidden
    });
  });

  describe("GET method", () => {
    it("returns 404 for non-existent file", async () => {
      const req = new Request("http://localhost/nonexistent.txt", {
        method: "GET",
      });
      const res = await app.request(req);

      expect(res.status).toBe(404);
    });

    it("returns directory listing as HTML", async () => {
      const persist3 = createMemoryAdapter();
      await persist3.ensureDir(["testdir"]);
      await persist3.writeFile(["testdir", "file.txt"], new TextEncoder().encode("content"), "text/plain");
      
      const app3 = makeWebdavApp({ persist: persist3 });

      const req = new Request("http://localhost/testdir", {
        method: "GET",
      });
      const res = await app3.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/html");

      const body = await res.text();
      expect(body).toContain("<html>");
      expect(body).toContain("Index of /testdir");
    });
  });

  describe("HEAD method", () => {
    it("returns headers without body", async () => {
      const persist4 = createMemoryAdapter();
      await persist4.writeFile(["test.txt"], new TextEncoder().encode("test content"), "text/plain");
      
      const app4 = makeWebdavApp({ persist: persist4 });

      const req = new Request("http://localhost/test.txt", {
        method: "HEAD",
      });
      const res = await app4.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/plain");
      
      const body = await res.text();
      expect(body).toBe("");
    });
  });
});
