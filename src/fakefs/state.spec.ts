/**
 * @file Unit: fakefs/state ensure/get/put behaviors
 */
import { createFsState, ensureDir, getEntry, putFile } from "./state";

describe("fakefs/state", () => {
  it("ensureDir creates nested directories and getEntry returns them", () => {
    const st = createFsState();
    const dir = ensureDir(st, ["a", "b", "c"]);
    expect(dir.type).toBe("dir");
    const got = getEntry(st, ["a", "b", "c"]);
    expect(got?.type).toBe("dir");
  });

  it("putFile stores content and size and is retrievable", () => {
    const st = createFsState();
    const f = putFile(st, ["x", "y.txt"], "hello", "text/plain");
    expect(f.type).toBe("file");
    expect(f.size).toBeGreaterThan(0);
    const got = getEntry(st, ["x", "y.txt"]);
    expect(got?.type).toBe("file");
    expect((got as typeof f).content).toBe("hello");
  });
});

