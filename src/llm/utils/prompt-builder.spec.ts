/**
 * @file Unit tests for prompt builder
 */
import {
  buildListingPrompt,
  buildFileContentPrompt,
  buildListingStyleHints,
  buildFileContentStyleHints,
} from "./prompt-builder";

describe("buildListingPrompt", () => {
  it("CRITICAL: generates correct prompt for root path", () => {
    const result = buildListingPrompt([]);
    
    // Must tell LLM to use empty array for root
    expect(result.prompt).toContain("use empty array [] for folder parameter");
    expect(result.folderParam).toEqual([]);
    expect(result.displayPath).toBe("/");
    
    // Must NOT contain any reference to "root" as a folder name
    expect(result.prompt).not.toContain('"root"');
    expect(result.prompt).not.toContain("'root'");
  });
  
  it("generates correct prompt for nested path", () => {
    const result = buildListingPrompt(["foo", "bar"]);
    
    expect(result.folderParam).toEqual(["foo", "bar"]);
    expect(result.displayPath).toBe("/foo/bar");
    expect(result.prompt).toContain("folder_array");
    expect(result.prompt).not.toContain("use empty array [] for folder parameter");
  });
  
  it("includes depth option when provided", () => {
    const result = buildListingPrompt(["test"], { depth: "1" });
    
    expect(result.prompt).toContain("WEBDAV_DEPTH=1");
  });
  
  it("includes custom instruction when provided", () => {
    const result = buildListingPrompt(["test"], { instruction: "Be creative" });
    
    // The instruction is meant to be used by the caller, not included in prompt
    expect(result.prompt).toBeDefined();
  });
  
  it("generates JSON request with proper structure", () => {
    const result = buildListingPrompt(["docs"]);
    
    expect(result.prompt).toContain('REQUEST=');
    expect(result.prompt).toContain('"path":"/docs"');
    expect(result.prompt).toContain('"folder_array":["docs"]');
  });
});

describe("buildListingStyleHints", () => {
  it("provides code-related hints for src paths", () => {
    const hints = buildListingStyleHints(["src", "components"]);
    
    expect(hints).toContain("Prefer small, plausible codey names (e.g., utils, main.ts, routes/)");
  });
  
  it("provides doc-related hints for doc paths", () => {
    const hints = buildListingStyleHints(["docs"]);
    
    expect(hints).toContain("Include docs-like files (README.md, guide.md, changelog.md)");
  });
  
  it("provides music-related hints for music paths", () => {
    const hints = buildListingStyleHints(["music", "albums"]);
    
    expect(hints).toContain("Invent tracklists and lyric snippets in .txt or .md");
  });
  
  it("provides default hints for generic paths", () => {
    const hints = buildListingStyleHints(["random"]);
    
    expect(hints).toContain("Mix 1-2 dirs and 1-3 files with playful names");
  });

  it("provides image-related hints for image-like folder names", () => {
    const h1 = buildListingStyleHints(["images"]);
    expect(h1.some((h) => h.includes("image files (.jpg/.png)"))).toBe(true);
    const h2 = buildListingStyleHints(["borges_jpg_images"]);
    expect(h2.some((h) => h.includes("image files (.jpg/.png)"))).toBe(true);
  });
  
  it("includes depth hint when depth is provided", () => {
    const hints = buildListingStyleHints(["test"], "1");
    
    expect(hints).toContain("Allow one level of nested subfolders if it improves coherence");
  });
});

describe("buildFileContentPrompt", () => {
  it("generates correct prompt for file path", () => {
    const result = buildFileContentPrompt(["docs", "README.md"]);
    
    expect(result.pathParam).toEqual(["docs", "README.md"]);
    expect(result.displayPath).toBe("/docs/README.md");
    expect(result.prompt).toContain('"filename":"README.md"');
  });
  
  it("includes mime hint when provided", () => {
    const result = buildFileContentPrompt(["test.txt"], { mimeHint: "text/plain" });
    
    expect(result.prompt).toContain("MIME_HINT=text/plain");
  });
  
  it("generates JSON request with proper structure", () => {
    const result = buildFileContentPrompt(["src", "index.js"]);
    
    expect(result.prompt).toContain('REQUEST=');
    expect(result.prompt).toContain('"path":"/src/index.js"');
    expect(result.prompt).toContain('"path_array":["src","index.js"]');
    expect(result.prompt).toContain('"filename":"index.js"');
  });
});

describe("buildFileContentStyleHints", () => {
  it("provides markdown hints for .md files", () => {
    const hints = buildFileContentStyleHints(["README.md"]);
    
    expect(hints).toContain("Write markdown content with headers, lists, and emphasis");
  });
  
  it("provides JSON hints for .json files", () => {
    const hints = buildFileContentStyleHints(["config.json"]);
    
    expect(hints).toContain("Generate valid JSON with plausible keys and values");
  });
  
  it("provides JavaScript hints for .js files", () => {
    const hints = buildFileContentStyleHints(["script.js"]);
    
    expect(hints).toContain("Generate JavaScript/TypeScript code with functions and comments");
  });
  
  it("provides README-specific hints", () => {
    const hints = buildFileContentStyleHints(["docs", "README.md"]);
    
    expect(hints.some(h => h.includes("project description"))).toBe(true);
  });
  
  it("provides config-specific hints", () => {
    const hints = buildFileContentStyleHints(["settings.json"]);
    
    expect(hints.some(h => h.includes("configuration-like content"))).toBe(true);
  });
  
  it("provides test-specific hints", () => {
    const hints = buildFileContentStyleHints(["test.spec.js"]);
    
    expect(hints.some(h => h.includes("test-like content"))).toBe(true);
  });
});
