/**
 * @file Unit: fakefs/generation deterministic listing and content
 */
import { createFsState, getEntry } from "./state";
import { generateListingForFolder, fabricateFileContent } from "./generation";

describe("fakefs/generation", () => {
  it("generateListingForFolder creates files and subdirs based on name", () => {
    const st = createFsState();
    generateListingForFolder(st, ["MystSeed"]);
    const dir = getEntry(st, ["MystSeed"]);
    expect(dir && dir.type).toBe("dir");
    const children = dir && dir.type === "dir" ? Array.from(dir.children.keys()) : [];
    expect(children.length).toBeGreaterThan(0);
  });

  it("fabricateFileContent yields stable lines for a path", () => {
    const a = fabricateFileContent(["A", "B", "C.txt"]);
    const b = fabricateFileContent(["A", "B", "C.txt"]);
    expect(a).toBe(b);
    expect(a).toContain("Uso800FS content");
  });
});

