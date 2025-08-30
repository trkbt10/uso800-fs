/**
 * @file Unit: webdav/handler minimal DAV flows without network
 */
import { createFsState, getEntry } from "../fakefs/state";
import { handleOptions, handlePropfind, handleMkcol, handleGet, handleHead, handlePut, handleDelete, handleMove, handleCopy } from "./handler";

describe("webdav/handler", () => {
  it("OPTIONS returns DAV headers", () => {
    const res = handleOptions();
    expect(res.status).toBe(200);
    expect(res.headers?.DAV).toContain("1");
    expect(res.headers?.Allow).toContain("PROPFIND");
  });

  it("MKCOL creates directory and generation populates children", () => {
    const st = createFsState();
    const r = handleMkcol(st, "/ProjectX");
    expect(r.status).toBe(201);
    const dir = getEntry(st, ["ProjectX"]);
    expect(dir && dir.type).toBe("dir");
    const children = dir && dir.type === "dir" ? Array.from(dir.children.keys()) : [];
    expect(children.length).toBeGreaterThan(0);
  });

  it("PROPFIND depth=0 lists self, depth=1 lists children", () => {
    const st = createFsState();
    handleMkcol(st, "/Seed");
    const resp0 = handlePropfind(st, "/Seed", "0");
    expect(resp0.status).toBe(207);
    expect(String(resp0.body)).toContain("multistatus");
    // depth 1
    const resp1 = handlePropfind(st, "/Seed", "1");
    expect(String(resp1.body)).toContain("href");
  });

  it("GET on dir returns html index; on file fabricates content", () => {
    const st = createFsState();
    handleMkcol(st, "/Alpha");
    const rDir = handleGet(st, "/Alpha");
    expect(rDir.status).toBe(200);
    expect(rDir.headers?.["Content-Type"]).toBe("text/html");
    // ensure a file path renders content
    const anyChild = getEntry(st, ["Alpha"]);
    let firstFile = "Alpha_1.txt";
    if (anyChild && anyChild.type === "dir") {
      for (const k of anyChild.children.keys()) {
        const child = getEntry(st, ["Alpha", k]);
        if (child && child.type === "file") {
          firstFile = k;
          break;
        }
      }
    }
    const rFile = handleGet(st, `/Alpha/${firstFile}`);
    expect(rFile.status).toBe(200);
    expect(String(rFile.body)).toContain("fabricated");
  });

  it("HEAD returns metadata", () => {
    const st = createFsState();
    handleMkcol(st, "/Beta");
    const r = handleHead(st, "/Beta");
    expect(r.status).toBe(200);
    expect(r.headers?.["Content-Type"]).toBe("text/html");
  });

  it("PUT/DELETE/MOVE/COPY basic flows", () => {
    const st = createFsState();
    handleMkcol(st, "/Zeta");
    // PUT creates a file
    const rPut = handlePut(st, "/Zeta/note.txt", "hello", "text/plain");
    expect(rPut.status).toBe(201);
    // MOVE file
    const rMove = handleMove(st, "/Zeta/note.txt", "/Zeta/renamed.txt");
    expect(rMove.status).toBe(201);
    // COPY file
    const rCopy = handleCopy(st, "/Zeta/renamed.txt", "/Zeta/copy.txt");
    expect(rCopy.status).toBe(201);
    // DELETE file
    const rDel = handleDelete(st, "/Zeta/copy.txt");
    expect(rDel.status).toBe(204);
  });
});
