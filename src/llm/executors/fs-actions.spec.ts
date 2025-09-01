/**
 * @file Unit tests for fs-actions executors (processFsListing, processEmitFile).
 */
import { processFsListing, processEmitFile, type FsExecDeps } from "./fs-actions";
import { createMemoryAdapter } from "../../webdav/persist/memory";
import type { ImageGenerationProvider, ImageKind, ImageGenerationRequest } from "../../image-generation/types";

function mockImageProvider(): ImageGenerationProvider {
  return {
    async generate({ request }: { repoId: string | number; kind: ImageKind; prompt: string; request: ImageGenerationRequest }) {
      const s = request.sizes[0];
      const data = Buffer.from("AAA", "base64").toString("base64");
      return { results: [{ size: s, url: `data:image/png;base64,${data}`, moderation: { nsfw: false } }] };
    },
  };
}

describe("fs-actions executors", () => {
  it("processFsListing creates dirs and writes text files, updating stats", async () => {
    const persist = createMemoryAdapter();
    const deps: FsExecDeps = { persist };
    const stats = { dirs: 0, files: 0, bytes: 0, dirNames: [], fileNames: [] as string[] };

    await processFsListing(deps, stats, ["a"], [
      { kind: "dir", name: "nested", content: "", mime: "" },
      { kind: "file", name: "note.txt", content: "hello", mime: "text/plain" },
    ]);

    expect(await persist.exists(["a", "nested"])).toBe(true);
    expect(await persist.exists(["a", "note.txt"])).toBe(true);
    const buf = await persist.readFile(["a", "note.txt"]);
    expect(Buffer.from(buf).toString("utf8")).toBe("hello");
    expect(stats.dirs).toBe(1);
    expect(stats.files).toBe(1);
    expect(stats.bytes).toBe(Buffer.byteLength("hello"));
    expect(stats.dirNames).toEqual(["nested"]);
    expect(stats.fileNames).toEqual(["note.txt"]);
  });

  it("processFsListing writes image bytes when mime is image/*", async () => {
    const persist = createMemoryAdapter();
    const deps: FsExecDeps = { persist, image: { provider: mockImageProvider(), repoId: "r1", kind: "thumbnail", request: { sizes: [{ w: 64, h: 64 }], style: "flat" } } };
    const stats = { dirs: 0, files: 0, bytes: 0, dirNames: [] as string[], fileNames: [] as string[] };

    await processFsListing(deps, stats, ["img"], [
      { kind: "file", name: "pic.png", content: "blue square", mime: "image/png" },
    ]);

    expect(await persist.exists(["img", "pic.png"])).toBe(true);
    const data = await persist.readFile(["img", "pic.png"]);
    expect(Buffer.from(data).length).toBe(Buffer.from("AAA", "base64").length);
    expect(stats.files).toBe(1);
    expect(stats.bytes).toBe(Buffer.from("AAA", "base64").length);
  });

  it("processEmitFile writes text and returns content", async () => {
    const persist = createMemoryAdapter();
    const deps: FsExecDeps = { persist };
    const stats = { files: 0, bytes: 0, fileName: undefined as string | undefined };

    const res = await processEmitFile(deps, stats, ["doc.txt"], "hello world", "text/plain");
    expect(res).toBe("hello world");
    expect(await persist.exists(["doc.txt"])).toBe(true);
    const buf = await persist.readFile(["doc.txt"]);
    expect(Buffer.from(buf).toString("utf8")).toBe("hello world");
    expect(stats.files).toBe(1);
    expect(stats.bytes).toBe(Buffer.byteLength("hello world"));
    expect(stats.fileName).toBe("doc.txt");
  });

  it("processEmitFile writes image and returns empty text", async () => {
    const persist = createMemoryAdapter();
    const deps: FsExecDeps = { persist, image: { provider: mockImageProvider(), repoId: "r2", kind: "icon", request: { sizes: [{ w: 32, h: 32 }], style: "flat" } } };
    const stats = { files: 0, bytes: 0 as number, fileName: undefined as string | undefined };

    const res = await processEmitFile(deps, stats, ["art.png"], "red circle", "image/png");
    expect(res).toBe("");
    expect(await persist.exists(["art.png"])).toBe(true);
    const buf = await persist.readFile(["art.png"]);
    expect(Buffer.from(buf).length).toBe(Buffer.from("AAA", "base64").length);
    expect(stats.files).toBe(1);
    expect(stats.fileName).toBe("art.png");
  });

  it("processEmitFile throws when image mime but no provider configured", async () => {
    const persist = createMemoryAdapter();
    const deps: FsExecDeps = { persist };
    const stats = { files: 0, bytes: 0 };
    await expect(processEmitFile(deps, stats, ["x.png"], "p", "image/png")).rejects.toThrow(/no image provider configured/);
  });
});
