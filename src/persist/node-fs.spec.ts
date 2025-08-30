/**
 * @file Unit: NodeFsAdapter with OS temp directory
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fsp } from "node:fs";
import { createNodeFsAdapter } from "./node-fs";

describe("persist/NodeFsAdapter", () => {
  const testDirPrefix = "uso800fs-test-";
  const createTempDir = async (): Promise<string> => {
    const tempRoot = tmpdir();
    const testDir = join(tempRoot, `${testDirPrefix}${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsp.mkdir(testDir, { recursive: true });
    return testDir;
  };

  const cleanupTempDir = async (dir: string): Promise<void> => {
    try {
      await fsp.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  it("should perform basic file operations in temp directory", async () => {
    const tempDir = await createTempDir();
    const adapter = createNodeFsAdapter(tempDir);

    try {
      // Test directory creation
      await adapter.ensureDir(["test", "nested", "dir"]);
      const dirExists = await adapter.exists(["test", "nested", "dir"]);
      expect(dirExists).toBe(true);

      // Test file write and read
      const content = "Hello from NodeFsAdapter test!";
      const data = new TextEncoder().encode(content);
      await adapter.writeFile(["test", "file.txt"], data);

      const readData = await adapter.readFile(["test", "file.txt"]);
      const readContent = new TextDecoder().decode(readData);
      expect(readContent).toBe(content);

      // Test stat
      const stat = await adapter.stat(["test", "file.txt"]);
      expect(stat.type).toBe("file");
      expect(stat.size).toBe(data.byteLength);
      expect(stat.mtime).toBeDefined();

      // Test readdir
      await adapter.writeFile(["test", "file2.txt"], new TextEncoder().encode("test2"));
      const files = await adapter.readdir(["test"]);
      expect(files).toContain("file.txt");
      expect(files).toContain("file2.txt");
      expect(files).toContain("nested");

      // Test move
      await adapter.move(["test", "file.txt"], ["test", "moved.txt"]);
      expect(await adapter.exists(["test", "file.txt"])).toBe(false);
      expect(await adapter.exists(["test", "moved.txt"])).toBe(true);

      // Test copy
      await adapter.copy(["test", "moved.txt"], ["test", "copied.txt"]);
      expect(await adapter.exists(["test", "moved.txt"])).toBe(true);
      expect(await adapter.exists(["test", "copied.txt"])).toBe(true);

      const copiedContent = new TextDecoder().decode(await adapter.readFile(["test", "copied.txt"]));
      expect(copiedContent).toBe(content);

      // Test remove
      await adapter.remove(["test", "copied.txt"]);
      expect(await adapter.exists(["test", "copied.txt"])).toBe(false);

      // Test directory stat
      const dirStat = await adapter.stat(["test", "nested"]);
      expect(dirStat.type).toBe("dir");
      expect(dirStat.size).toBeUndefined();
      expect(dirStat.mtime).toBeDefined();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should handle directory operations", async () => {
    const tempDir = await createTempDir();
    const adapter = createNodeFsAdapter(tempDir);

    try {
      // Create nested directory structure
      await adapter.ensureDir(["dir1", "dir2", "dir3"]);
      await adapter.writeFile(["dir1", "dir2", "file.txt"], new TextEncoder().encode("nested file"));

      // Copy directory
      await adapter.copy(["dir1"], ["dir1-copy"]);
      expect(await adapter.exists(["dir1-copy", "dir2", "dir3"])).toBe(true);
      expect(await adapter.exists(["dir1-copy", "dir2", "file.txt"])).toBe(true);

      const copiedContent = new TextDecoder().decode(
        await adapter.readFile(["dir1-copy", "dir2", "file.txt"])
      );
      expect(copiedContent).toBe("nested file");

      // Move directory
      await adapter.move(["dir1-copy"], ["dir1-moved"]);
      expect(await adapter.exists(["dir1-copy"])).toBe(false);
      expect(await adapter.exists(["dir1-moved", "dir2", "file.txt"])).toBe(true);

      // Remove directory
      await adapter.remove(["dir1-moved"]);
      expect(await adapter.exists(["dir1-moved"])).toBe(false);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should handle edge cases", async () => {
    const tempDir = await createTempDir();
    const adapter = createNodeFsAdapter(tempDir);

    try {
      // Test reading non-existent file
      await expect(adapter.readFile(["non-existent.txt"])).rejects.toThrow();

      // Test stat on non-existent path
      await expect(adapter.stat(["non-existent"])).rejects.toThrow();

      // Test readdir on non-existent directory
      await expect(adapter.readdir(["non-existent"])).rejects.toThrow();

      // Test exists on non-existent path
      const exists = await adapter.exists(["non-existent"]);
      expect(exists).toBe(false);

      // Test writing to deeply nested path (should create parent dirs)
      await adapter.writeFile(["a", "b", "c", "d", "file.txt"], new TextEncoder().encode("deep"));
      expect(await adapter.exists(["a", "b", "c", "d", "file.txt"])).toBe(true);

      // Test empty directory listing
      await adapter.ensureDir(["empty"]);
      const emptyList = await adapter.readdir(["empty"]);
      expect(emptyList).toEqual([]);

      // Test overwriting existing file
      await adapter.writeFile(["overwrite.txt"], new TextEncoder().encode("original"));
      await adapter.writeFile(["overwrite.txt"], new TextEncoder().encode("updated"));
      const content = new TextDecoder().decode(await adapter.readFile(["overwrite.txt"]));
      expect(content).toBe("updated");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should handle special characters in paths", async () => {
    const tempDir = await createTempDir();
    const adapter = createNodeFsAdapter(tempDir);

    try {
      // Test with spaces and special characters
      const specialName = "file with spaces & special-chars_123.txt";
      await adapter.writeFile([specialName], new TextEncoder().encode("special content"));
      
      const exists = await adapter.exists([specialName]);
      expect(exists).toBe(true);

      const content = new TextDecoder().decode(await adapter.readFile([specialName]));
      expect(content).toBe("special content");

      // Test unicode characters
      const unicodeName = "файл_测试_🎉.txt";
      await adapter.writeFile([unicodeName], new TextEncoder().encode("unicode content"));
      
      const unicodeExists = await adapter.exists([unicodeName]);
      expect(unicodeExists).toBe(true);

      const files = await adapter.readdir([]);
      expect(files).toContain(specialName);
      expect(files).toContain(unicodeName);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should clean up all test directories after tests", async () => {
    // Clean up any leftover test directories
    const tempRoot = tmpdir();
    const entries = await fsp.readdir(tempRoot, { withFileTypes: true });
    
    const cleanupPromises = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(testDirPrefix))
      .map(entry => cleanupTempDir(join(tempRoot, entry.name)));
    
    await Promise.all(cleanupPromises);
  });
});