/**
 * @file Verifies that PROPFIND listings reflect changes after MKCOL/PUT/DELETE/MOVE operations.
 */
import { makeWebdavApp } from "./server";
import { createMemoryAdapter } from "./persist/memory";
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

async function propfindXml(app: ReturnType<typeof makeWebdavApp>, path: string, depth: string): Promise<string> {
  const pf = await app.request(path, { method: "PROPFIND", headers: { Depth: depth } });
  expect(pf.status).toBe(207);
  return await pf.text();
}

describe("WebDAV listings update on changes (memory)", () => {
  it("reflects create/delete/rename/move in PROPFIND Depth:1", async () => {
    const persist = createMemoryAdapter();
    const app = makeWebdavApp({ persist });

    // Start empty
    const xml0 = await propfindXml(app, "/", "1");
    expect(xml0).not.toContain("dirA");
    expect(xml0).not.toContain("a.txt");

    // Create folder and file
    const mk = await app.request("/dirA", { method: "MKCOL" });
    expect([201, 405]).toContain(mk.status);
    const put = await app.request("/a.txt", { method: "PUT", body: "hello" });
    expect(put.status).toBe(201);

    const xml1 = await propfindXml(app, "/", "1");
    expect(xml1).toContain("dirA");
    expect(xml1).toContain("a.txt");

    // Delete file
    const del = await app.request("/a.txt", { method: "DELETE" });
    expect([204, 404]).toContain(del.status);
    const xml2 = await propfindXml(app, "/", "1");
    expect(xml2).not.toContain("a.txt");
    expect(xml2).toContain("dirA");

    // Rename folder dirA -> dirB via MOVE
    const mv1 = await app.request("/dirA", { method: "MOVE", headers: { Destination: "http://localhost/dirB", Overwrite: "T", Depth: "infinity" } });
    expect([201, 204]).toContain(mv1.status);
    const xml3 = await propfindXml(app, "/", "1");
    expect(xml3).toContain("dirB");
    expect(xml3).not.toContain("dirA");

    // Create file inside dirB and then move it to root
    const put2 = await app.request("/dirB/b.txt", { method: "PUT", body: "b" });
    expect(put2.status).toBe(201);
    const mv2 = await app.request("/dirB/b.txt", { method: "MOVE", headers: { Destination: "http://localhost/b2.txt", Overwrite: "T" } });
    expect([201, 204]).toContain(mv2.status);
    const xml4 = await propfindXml(app, "/", "1");
    expect(xml4).toContain("b2.txt");
    const xmlDirB = await propfindXml(app, "/dirB", "1");
    expect(xmlDirB).not.toContain("b.txt");

    // Delete folder
    const delDir = await app.request("/dirB", { method: "DELETE" });
    expect([204, 404]).toContain(delDir.status);
    const xml5 = await propfindXml(app, "/", "1");
    expect(xml5).not.toContain("dirB");
  });
});

describe("WebDAV listings update on changes (node-fs)", () => {
  it("reflects create/delete/rename/move in PROPFIND Depth:1 with NodeFS", async () => {
    const root = tmpRoot("list-updates-nodefs");
    await ensureEmptyDir(root);
    const persist = createNodeFsAdapter(root);
    const app = makeWebdavApp({ persist });

    // Start empty
    const xml0 = await propfindXml(app, "/", "1");
    expect(xml0).not.toContain("dirA");
    expect(xml0).not.toContain("a.txt");

    // Create folder and file
    const mk = await app.request("/dirA", { method: "MKCOL" });
    expect([201, 405]).toContain(mk.status);
    const put = await app.request("/a.txt", { method: "PUT", body: "hello" });
    expect(put.status).toBe(201);

    const xml1 = await propfindXml(app, "/", "1");
    expect(xml1).toContain("dirA");
    expect(xml1).toContain("a.txt");

    // Delete file
    const del = await app.request("/a.txt", { method: "DELETE" });
    expect([204, 404]).toContain(del.status);
    const xml2 = await propfindXml(app, "/", "1");
    expect(xml2).not.toContain("a.txt");
    expect(xml2).toContain("dirA");

    // Rename folder dirA -> dirB via MOVE
    const mv1 = await app.request("/dirA", { method: "MOVE", headers: { Destination: "http://localhost/dirB", Overwrite: "T", Depth: "infinity" } });
    expect([201, 204]).toContain(mv1.status);
    const xml3 = await propfindXml(app, "/", "1");
    expect(xml3).toContain("dirB");
    expect(xml3).not.toContain("dirA");

    // Create file inside dirB and then move it to root
    const put2 = await app.request("/dirB/b.txt", { method: "PUT", body: "b" });
    expect(put2.status).toBe(201);
    const mv2 = await app.request("/dirB/b.txt", { method: "MOVE", headers: { Destination: "http://localhost/b2.txt", Overwrite: "T" } });
    expect([201, 204]).toContain(mv2.status);
    const xml4 = await propfindXml(app, "/", "1");
    expect(xml4).toContain("b2.txt");
    const xmlDirB = await propfindXml(app, "/dirB", "1");
    expect(xmlDirB).not.toContain("b.txt");

    // Delete folder
    const delDir = await app.request("/dirB", { method: "DELETE" });
    expect([204, 404]).toContain(delDir.status);
    const xml5 = await propfindXml(app, "/", "1");
    expect(xml5).not.toContain("dirB");
  });
});
