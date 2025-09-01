/**
 * @file Persistence integration: ensure WebDAV operations hit persisted files
 * in flat and nested folder structures using the Node FS adapter.
 */
import { makeWebdavApp } from "./server";
import { createNodeFsAdapter } from "./persist/node-fs";
import { promises as fsp } from "node:fs";
import { join } from "node:path";

function tmpRoot(name: string): string {
  const base = join(process.cwd(), ".tmp");
  return join(base, name);
}

async function ensureEmptyDir(dir: string): Promise<void> {
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  await fsp.mkdir(dir, { recursive: true });
}

describe("WebDAV persistence (Node FS)", () => {
  it("persists flat files across app instances", async () => {
    const root = tmpRoot("persist-flat");
    await ensureEmptyDir(root);

    // Instance 1: create file
    {
      const persist = createNodeFsAdapter(root);
      const app = makeWebdavApp({ persist });
      const put = await app.request("/file.txt", { method: "PUT", body: "hello" });
      expect(put.status).toBe(201);
      const get = await app.request("/file.txt", { method: "GET" });
      expect(get.status).toBe(200);
      expect(await get.text()).toBe("hello");
    }

    // Instance 2: same root, should read existing content
    {
      const persist2 = createNodeFsAdapter(root);
      const app2 = makeWebdavApp({ persist: persist2 });
      const get2 = await app2.request("/file.txt", { method: "GET" });
      expect(get2.status).toBe(200);
      expect(await get2.text()).toBe("hello");
      const pf = await app2.request("/", { method: "PROPFIND", headers: { Depth: "1" } });
      expect(pf.status).toBe(207);
      expect(await pf.text()).toContain("file.txt");
    }
  });

  it("persists nested directories and operations (MKCOL/PUT/MOVE/COPY/DELETE)", async () => {
    const root = tmpRoot("persist-nested");
    await ensureEmptyDir(root);

    // Instance 1: create nested structure
    {
      const persist = createNodeFsAdapter(root);
      const app = makeWebdavApp({ persist });

      // Create dir and files
      const mk = await app.request("/dir", { method: "MKCOL" });
      expect([201, 405]).toContain(mk.status);
      const p1 = await app.request("/dir/sub.txt", { method: "PUT", body: "abc" });
      expect(p1.status).toBe(201);
      const mk2 = await app.request("/dir/subdir", { method: "MKCOL" });
      expect([201, 405]).toContain(mk2.status);
      const p2 = await app.request("/dir/subdir/deep.txt", { method: "PUT", body: "deep" });
      expect(p2.status).toBe(201);

      // PROPFIND depth:1 shows immediate children
      const pf1 = await app.request("/dir", { method: "PROPFIND", headers: { Depth: "1" } });
      expect(pf1.status).toBe(207);
      const xml1 = await pf1.text();
      expect(xml1).toContain("sub.txt");
      expect(xml1).toContain("subdir");
    }

    // Instance 2: verify persisted content and operations
    {
      const persist2 = createNodeFsAdapter(root);
      const app2 = makeWebdavApp({ persist: persist2 });

      // Read deep file
      const rd = await app2.request("/dir/subdir/deep.txt", { method: "GET" });
      expect(rd.status).toBe(200);
      expect(await rd.text()).toBe("deep");

      // MOVE sub -> sub2
      const mv = await app2.request("/dir/sub.txt", { method: "MOVE", headers: { Destination: "http://localhost/dir/sub2.txt", Overwrite: "T" } });
      expect([204, 201]).toContain(mv.status);
      const g2 = await app2.request("/dir/sub2.txt", { method: "GET" });
      expect(g2.status).toBe(200);
      expect(await g2.text()).toBe("abc");

      // COPY deep -> copy
      const cp = await app2.request("/dir/subdir/deep.txt", { method: "COPY", headers: { Destination: "http://localhost/dir/deep-copy.txt", Overwrite: "T" } });
      expect([204, 201]).toContain(cp.status);
      const gc = await app2.request("/dir/deep-copy.txt", { method: "GET" });
      expect(gc.status).toBe(200);
      expect(await gc.text()).toBe("deep");

      // DELETE deep-copy persists
      const del = await app2.request("/dir/deep-copy.txt", { method: "DELETE" });
      expect(del.status).toBe(204);
      const after = await app2.request("/dir/deep-copy.txt", { method: "GET" });
      expect(after.status).toBe(404);
    }
  });
});

