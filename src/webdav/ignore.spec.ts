/**
 * @file Unit tests for ignore utilities
 */
import { buildIgnoreRegexps, isIgnoredFactory, createIgnoreFilteringAdapter } from "./ignore";
import { createMemoryAdapter } from "./persist/memory";

describe("ignore utils", () => {
  it("matches defaults and custom globs", () => {
    const res = buildIgnoreRegexps(["**/*.tmp", "node_modules/**"]);
    const isIgnored = isIgnoredFactory(res);
    expect(isIgnored("/.DS_Store")).toBe(true);
    expect(isIgnored("/foo/._bar"));
    expect(isIgnored("/foo/file.tmp")).toBe(true);
    expect(isIgnored("node_modules/pkg/index.js")).toBe(true);
    expect(isIgnored("/src/index.ts")).toBe(false);
  });

  it("filters readdir results via adapter wrapper", async () => {
    const base = createMemoryAdapter();
    await base.ensureDir(["dir"]);
    await base.writeFile(["dir", "a.txt"], new Uint8Array([0]), "application/octet-stream");
    await base.writeFile(["dir", "b.tmp"], new Uint8Array([0]), "application/octet-stream");
    const res = buildIgnoreRegexps(["**/*.tmp"]);
    const isIgnored = isIgnoredFactory(res);
    const fs = createIgnoreFilteringAdapter(base, isIgnored);
    const names = await fs.readdir(["dir"]);
    expect(names).toContain("a.txt");
    expect(names).not.toContain("b.tmp");
  });
});
