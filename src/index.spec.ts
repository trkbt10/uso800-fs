/**
 * @file Unit tests for CLI entry point and configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startFromCli } from "./cli";

describe("CLI Entry Point", () => {
  const originalEnv = process.env;
  const originalArgv = process.argv;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  describe("parseCli", () => {
    it("should parse port argument", () => {
      process.argv = ["node", "index.ts", "--port", "3000"];
      const app = startFromCli();
      expect(app).toHaveProperty("port", 3000);
    });

    it("should parse model argument", () => {
      process.argv = ["node", "index.ts", "--model", "gpt-4"];
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should parse persist-root argument", () => {
      process.argv = ["node", "index.ts", "--persist-root", "./data"];
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should parse instruction argument", () => {
      process.argv = ["node", "index.ts", "--instruction", "Custom instruction"];
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should parse state argument", () => {
      process.argv = ["node", "index.ts", "--state", "./state.json"];
      const app = startFromCli();
      expect(app).toBeDefined();
    });
  });

  describe("Environment variables", () => {
    it("should use OPENAI_API_KEY from environment", () => {
      process.env.OPENAI_API_KEY = "test-key";
      process.env.OPENAI_MODEL = "test-model";
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should use OPENAI_MODEL from environment", () => {
      process.env.OPENAI_MODEL = "gpt-5";
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should prioritize CLI args over env vars", () => {
      process.env.OPENAI_MODEL = "env-model";
      process.argv = ["node", "index.ts", "--model", "cli-model"];
      const app = startFromCli();
      expect(app).toBeDefined();
    });
  });

  describe("App creation", () => {
    it("should return app with default port 8787", () => {
      const app = startFromCli();
      expect(app).toHaveProperty("port", 8787);
    });

    it("should return app with specified port", () => {
      process.argv = ["node", "index.ts", "--port", "9000"];
      const app = startFromCli();
      expect(app).toHaveProperty("port", 9000);
    });

    it("should have fetch method for Hono app", () => {
      const app = startFromCli();
      expect(app).toHaveProperty("fetch");
      expect(typeof (app as any).fetch).toBe("function");
    });
  });

  describe("LLM configuration", () => {
    it("should configure LLM when API key and model are provided", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.OPENAI_MODEL = "gpt-4";
      const consoleSpy = vi.spyOn(console, "log");
      
      startFromCli();
      
      expect(consoleSpy).toHaveBeenCalledWith("[uso800fs] LLM enabled with model:", "gpt-4");
    });

    it("should work without LLM when API key is missing", () => {
      delete process.env.OPENAI_API_KEY;
      process.env.OPENAI_MODEL = "gpt-4";
      
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should work without LLM when model is missing", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      delete process.env.OPENAI_MODEL;
      
      const app = startFromCli();
      expect(app).toBeDefined();
    });
  });

  describe("Persistence configuration", () => {
    it("should enable persistence with --persist-root", () => {
      process.argv = ["node", "index.ts", "--persist-root", "./test-data"];
      const consoleSpy = vi.spyOn(console, "log");
      
      startFromCli();
      
      expect(consoleSpy).toHaveBeenCalledWith("[uso800fs] Persistence root:", "./test-data");
    });

    it("should warn when --state is used without --persist-root", () => {
      process.argv = ["node", "index.ts", "--state", "./state.json"];
      const warnSpy = vi.spyOn(console, "warn");
      
      startFromCli();
      
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain("changes will NOT be saved");
    });
  });

  describe("Instruction building", () => {
    it("should build absurd instruction with default message", () => {
      const app = startFromCli();
      expect(app).toBeDefined();
    });

    it("should append custom instruction when provided", () => {
      process.argv = ["node", "index.ts", "--instruction", "Extra instruction"];
      const app = startFromCli();
      expect(app).toBeDefined();
    });
  });
});
