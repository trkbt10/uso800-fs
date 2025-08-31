/**
 * @file Unit: NodeFsAdapter error handling tests
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fsp } from "node:fs";
import { createNodeFsAdapter } from "./node-fs";

describe("persist/NodeFsAdapter - Error Handling", () => {
  const testDirPrefix = "uso800fs-error-test-";
  const createTempDir = async (): Promise<string> => {
    const tempRoot = tmpdir();
    const testDir = join(tempRoot, `${testDirPrefix}${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsp.mkdir(testDir, { recursive: true });
    return testDir;
  };

  const cleanupTempDir = async (dir: string): Promise<void> => {
    try {
      // Reset permissions before cleanup
      await fsp.chmod(dir, 0o755).catch(() => {});
      const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const path = join(dir, entry.name);
        await fsp.chmod(path, 0o755).catch(() => {});
        if (entry.isDirectory()) {
          await cleanupTempDir(path);
        }
      }
      await fsp.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  describe("Permission errors", () => {
    it("should handle read permission errors", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // Create a file and remove read permissions
        const testFile = join(tempDir, "no-read.txt");
        await fsp.writeFile(testFile, "test content");
        await fsp.chmod(testFile, 0o000); // No permissions

        // Try to read the file
        await expect(adapter.readFile(["no-read.txt"])).rejects.toThrow(/Permission denied/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should handle write permission errors on directory", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // Create a subdirectory and remove write permissions
        const subDir = join(tempDir, "readonly");
        await fsp.mkdir(subDir);
        await fsp.chmod(subDir, 0o555); // Read and execute only

        // Try to write a file in the readonly directory
        await expect(adapter.writeFile(["readonly", "file.txt"], new TextEncoder().encode("test"))).rejects.toThrow(/Permission denied/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should handle directory access permission errors", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // Create a directory with no execute permission
        const noAccessDir = join(tempDir, "no-access");
        await fsp.mkdir(noAccessDir);
        await fsp.writeFile(join(noAccessDir, "file.txt"), "content");
        await fsp.chmod(noAccessDir, 0o000); // No permissions

        // Try to list directory contents
        await expect(adapter.readdir(["no-access"])).rejects.toThrow(/Permission denied/);

        // Try to check if a file exists inside
        await expect(adapter.exists(["no-access", "file.txt"])).rejects.toThrow(/Permission denied/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });

  describe("File not found errors", () => {
    it("should provide clear error for non-existent files", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        await expect(adapter.readFile(["non-existent.txt"])).rejects.toThrow(/File not found/);
        await expect(adapter.stat(["non-existent.txt"])).rejects.toThrow(/File not found/);
        await expect(adapter.readdir(["non-existent-dir"])).rejects.toThrow(/File not found/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should handle exists() correctly for non-existent files", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // exists() should return false, not throw
        const exists = await adapter.exists(["non-existent.txt"]);
        expect(exists).toBe(false);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });

  describe("Type mismatch errors", () => {
    it("should handle reading directory as file", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        await adapter.ensureDir(["test-dir"]);
        
        // Try to read directory as file
        await expect(adapter.readFile(["test-dir"])).rejects.toThrow(/Is a directory/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should handle listing file as directory", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        await adapter.writeFile(["test.txt"], new TextEncoder().encode("content"));
        
        // Try to list file as directory
        await expect(adapter.readdir(["test.txt"])).rejects.toThrow(/Not a directory/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });

  describe("Move and copy errors", () => {
    it("should handle moving non-existent files", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        await expect(adapter.move(["non-existent.txt"], ["destination.txt"])).rejects.toThrow(/File not found/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should handle copying non-existent files", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        await expect(adapter.copy(["non-existent.txt"], ["destination.txt"])).rejects.toThrow(/File not found/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should handle moving to a readonly directory", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // Create source file
        await adapter.writeFile(["source.txt"], new TextEncoder().encode("content"));
        
        // Create readonly destination directory
        const readonlyDir = join(tempDir, "readonly");
        await fsp.mkdir(readonlyDir);
        await fsp.chmod(readonlyDir, 0o555); // Read and execute only

        // Try to move file to readonly directory
        await expect(adapter.move(["source.txt"], ["readonly", "dest.txt"])).rejects.toThrow(/Permission denied/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });

  describe("Remove errors", () => {
    it("should handle removing files without permission", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // Create a directory with a file
        const protectedDir = join(tempDir, "protected");
        await fsp.mkdir(protectedDir);
        await fsp.writeFile(join(protectedDir, "file.txt"), "content");
        
        // Remove write permission from directory
        await fsp.chmod(protectedDir, 0o555); // Read and execute only

        // Try to remove the file
        await expect(adapter.remove(["protected", "file.txt"])).rejects.toThrow(/Permission denied/);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it("should not throw when removing non-existent files", async () => {
      const tempDir = await createTempDir();
      const adapter = createNodeFsAdapter(tempDir);

      try {
        // Should not throw for non-existent files
        await expect(adapter.remove(["non-existent.txt"])).resolves.toBeUndefined();
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });

  describe("Disk space errors", () => {
    // Note: Testing actual disk space errors is difficult in a unit test
    // This would require mocking or a special test environment
    it.skip("should handle disk full errors", async () => {
      // This test would require a mock filesystem or special test setup
      // to simulate ENOSPC errors
    });
  });

  afterAll(async () => {
    // Clean up any leftover test directories
    const tempRoot = tmpdir();
    const entries = await fsp.readdir(tempRoot, { withFileTypes: true });
    
    const cleanupPromises = entries
      .filter(entry => entry.isDirectory() ? entry.name.startsWith(testDirPrefix) : false)
      .map(entry => cleanupTempDir(join(tempRoot, entry.name)));
    
    await Promise.all(cleanupPromises);
  });
});
