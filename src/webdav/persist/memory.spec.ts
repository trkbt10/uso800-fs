/**
 * @file Unit: MemoryAdapter basic file IO
 */
import { createMemoryAdapter } from "./memory";

describe("persist/MemoryAdapter", () => {
  it("mkdir, write, read, move, copy, delete", async () => {
    const a = createMemoryAdapter();
    await a.ensureDir(["d1"]);
    await a.writeFile(["d1", "a.txt"], new TextEncoder().encode("hello"));
    const list = await a.readdir(["d1"]);
    expect(list).toContain("a.txt");
    const stat = await a.stat(["d1", "a.txt"]);
    expect(stat.type).toBe("file");
    const buf = await a.readFile(["d1", "a.txt"]);
    expect(new TextDecoder().decode(buf)).toBe("hello");
    await a.move(["d1", "a.txt"], ["d1", "b.txt"]);
    await a.copy(["d1", "b.txt"], ["d1", "c.txt"]);
    const list2 = await a.readdir(["d1"]);
    expect(list2).toEqual(expect.arrayContaining(["b.txt", "c.txt"]));
    await a.remove(["d1", "c.txt"]);
    const list3 = await a.readdir(["d1"]);
    expect(list3).toEqual(expect.arrayContaining(["b.txt"]));
  });
});
