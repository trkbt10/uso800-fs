/**
 * @file Sanity checks for tool JSON Schemas used by OpenAI Responses API.
 * Ensures each tool has parameters with { type: 'object', additionalProperties: false }
 * and that required keys are declared as expected.
 */
// Use global describe/it/expect from test runner
import { getOpenAIToolsSpec } from "./index";

type JsonSchemaObject = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

function isJsonSchemaObject(x: unknown): x is JsonSchemaObject {
  if (typeof x !== "object" || x === null) {
    return false;
  }
  const r = x as Record<string, unknown>;
  if (r.type !== "object") {
    return false;
  }
  if (typeof r.properties !== "object" || r.properties === null) {
    return false;
  }
  if (r.additionalProperties !== false) {
    return false;
  }
  if ("required" in r && !Array.isArray(r.required)) {
    return false;
  }
  return true;
}

// Expected required keys per tool (align with normalize implementations)
const expectedRequired: Record<string, string[]> = {
  create_dir: ["path"],
  create_file: ["path", "content", "mime"],
  write_file: ["path", "content", "mime"],
  remove_entry: ["path"],
  move_entry: ["from", "to"],
  copy_entry: ["from", "to"],
  emit_fs_listing: ["folder", "entries"],
  emit_file_content: ["path", "content", "mime"],
};

describe("LLM tool JSON Schemas", () => {
  const specs = getOpenAIToolsSpec();

  it("all tools must declare parameters with additionalProperties:false", () => {
    for (const t0 of specs) {
      const params: unknown =
        typeof t0 === "object" && t0 !== null ? (t0 as { [k: string]: unknown }).parameters : undefined;
      expect(isJsonSchemaObject(params)).toBe(true);
      const p = params as JsonSchemaObject;
      expect(p.additionalProperties).toBe(false);
      expect(p.type).toBe("object");
    }
  });

  it("required keys must be declared as expected", () => {
    for (const t0 of specs) {
      const name = t0.name;
      const expectReq = expectedRequired[name] ?? [];
      const p: unknown =
        typeof t0 === "object" && t0 !== null ? (t0 as { [k: string]: unknown }).parameters : undefined;
      expect(isJsonSchemaObject(p)).toBe(true);
      const schema = p as JsonSchemaObject;
      const r = schema.required ?? [];
      for (const k of expectReq) {
        expect(r).toContain(k);
      }
    }
  });
});
