/**
 * @file Prompt building utilities for LLM interactions
 */

import { isRootPath, segmentsToDisplayPath } from "./path-utils";

/**
 * Options for building a listing prompt.
 */
export type ListingPromptOptions = {
  depth?: string | null;
  instruction?: string;
};

/**
 * Result of building a listing prompt.
 */
export type ListingPromptResult = {
  prompt: string;
  folderParam: string[];
  displayPath: string;
};

/**
 * Builds style hints based on the folder path.
 */
export function buildListingStyleHints(segments: string[], depth?: string | null): string[] {
  const tokens = segments.join("/").toLowerCase();
  const hints: string[] = [];
  
  if (tokens.includes("src")) {
    hints.push("Prefer small, plausible codey names (e.g., utils, main.ts, routes/)");
  }
  if (tokens.includes("doc") || tokens.includes("readme")) {
    hints.push("Include docs-like files (README.md, guide.md, changelog.md)");
  }
  if (tokens.includes("music") || tokens.includes("song")) {
    hints.push("Invent tracklists and lyric snippets in .txt or .md");
  }
  if (!hints.length) {
    hints.push("Mix 1-2 dirs and 1-3 files with playful names");
  }
  if (depth && depth !== "0") {
    hints.push("Allow one level of nested subfolders if it improves coherence");
  }
  
  return hints;
}

/**
 * Builds the listing prompt for LLM.
 * This is a pure function that can be easily tested.
 */
export function buildListingPrompt(
  folderPath: string[],
  options?: ListingPromptOptions
): ListingPromptResult {
  const displayPath = segmentsToDisplayPath(folderPath);
  const isRoot = isRootPath(folderPath);
  
  const promptParts = [
    "Fabricate a directory listing for the given folder.",
    "Use the provided tool to emit the listing (no prose).",
    options?.depth ? `WEBDAV_DEPTH=${options.depth}` : undefined,
    "STYLE_HINTS:\n- " + buildListingStyleHints(folderPath, options?.depth).join("\n- "),
    "REQUEST=" + JSON.stringify({ 
      path: displayPath,
      folder_array: folderPath,
      note: isRoot ? "This is the root folder, use empty array [] for folder parameter" : undefined
    }),
    undefined,
  ];
  
  const prompt = promptParts.filter(Boolean).join("\n\n");
  
  return {
    prompt,
    folderParam: folderPath,
    displayPath,
  };
}

/**
 * Options for building a file content prompt.
 */
export type FileContentPromptOptions = {
  mimeHint?: string | null;
  instruction?: string;
};

/**
 * Result of building a file content prompt.
 */
export type FileContentPromptResult = {
  prompt: string;
  pathParam: string[];
  displayPath: string;
};

/**
 * Builds style hints for file content based on the file path.
 */
export function buildFileContentStyleHints(segments: string[]): string[] {
  const hints: string[] = [];
  const filename = segments.length > 0 ? segments[segments.length - 1] : "";
  const ext = filename.split(".").pop()?.toLowerCase();
  
  switch (ext) {
    case "md":
    case "markdown":
      hints.push("Write markdown content with headers, lists, and emphasis");
      break;
    case "json":
      hints.push("Generate valid JSON with plausible keys and values");
      break;
    case "txt":
      hints.push("Create plain text content, could be prose, lists, or notes");
      break;
    case "html":
      hints.push("Generate a simple HTML document with basic structure");
      break;
    case "css":
      hints.push("Write CSS rules with selectors and properties");
      break;
    case "js":
    case "ts":
      hints.push("Generate JavaScript/TypeScript code with functions and comments");
      break;
    default:
      hints.push("Create content appropriate for the file type");
  }
  
  // Add context-based hints
  const pathStr = segments.join("/").toLowerCase();
  if (pathStr.includes("readme")) {
    hints.push("Include project description, installation, and usage sections");
  }
  if (pathStr.includes("config") || pathStr.includes("settings")) {
    hints.push("Generate configuration-like content with options and values");
  }
  if (pathStr.includes("test") || pathStr.includes("spec")) {
    hints.push("Create test-like content with assertions or test cases");
  }
  
  return hints;
}

/**
 * Builds the file content prompt for LLM.
 * This is a pure function that can be easily tested.
 */
export function buildFileContentPrompt(
  pathParts: string[],
  options?: FileContentPromptOptions
): FileContentPromptResult {
  const displayPath = segmentsToDisplayPath(pathParts);
  const filename = pathParts[pathParts.length - 1] ?? "";
  const ext = filename.split('.').pop()?.toLowerCase();
  const isImage = (() => {
    if (typeof options?.mimeHint === 'string') {
      return options.mimeHint.startsWith('image/');
    }
    const known = ["png","jpg","jpeg","gif","webp","svg"] as const;
    return known.includes((ext ?? "") as typeof known[number]);
  })();
  
  const baseParts = [
    "Fabricate plausible file content for the requested path.",
    "Use the provided tools for file creation (no prose).",
    isImage ? "Prefer the image file tool for image types." : "Prefer the text file tool for non-image types.",
    options?.mimeHint ? `MIME_HINT=${options.mimeHint}` : undefined,
    "STYLE_HINTS:\n- " + buildFileContentStyleHints(pathParts).join("\n- "),
    "REQUEST=" + JSON.stringify({ path: displayPath, path_array: pathParts, filename: pathParts[pathParts.length - 1] }),
  ];
  const prompt = baseParts
    .filter(Boolean)
    .join("\n\n");
  
  return {
    prompt,
    pathParam: pathParts,
    displayPath,
  };
}
