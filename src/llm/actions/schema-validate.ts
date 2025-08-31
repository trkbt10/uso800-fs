/**
 * @file Validate tool parameter JSON Schemas against OpenAI-compatible subset.
 */
import type { ToolSpec } from "./tools";

export type ValidationIssue = {
  tool: string;
  message: string;
  path: string;
};

export type ValidationResult = { ok: boolean; errors: ValidationIssue[] };

const DISALLOWED_KEYS = new Set(["oneOf", "anyOf", "allOf", "not"]);

function join(path: string[], key: string | number): string[] {
  return [...path, String(key)];
}

function hasOwn(obj: unknown, key: string): boolean {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function validateSchemaNode(tool: string, node: unknown, path: string[], strict: boolean, out: ValidationIssue[]) {
  if (typeof node !== "object" || node === null) {
    return;
  }
  const rec = node as Record<string, unknown>;

  // Disallow composition keywords
  for (const k of Object.keys(rec)) {
    if (DISALLOWED_KEYS.has(k)) {
      out.push({ tool, path: path.join("."), message: `'${k}' is not permitted.` });
    }
  }

  const type = rec["type"];
  if (type === "object") {
    // additionalProperties must be false (OpenAI strict subset)
    if (rec["additionalProperties"] !== false) {
      out.push({ tool, path: path.join("."), message: `object.additionalProperties must be false.` });
    }

    const props = rec["properties"];
    if (typeof props !== "object" || props === null) {
      out.push({ tool, path: path.join("."), message: `object.properties must be an object.` });
    } else {
      const propKeys = Object.keys(props as Record<string, unknown>);
      // In strict mode, required must exist and include every key in properties
      if (strict) {
        if (!Array.isArray(rec["required"])) {
          out.push({ tool, path: path.join("."), message: `object.required must be an array including all property keys.` });
        } else {
          const required = new Set((rec["required"] as unknown[]).map((x) => String(x)));
          for (const k of propKeys) {
            if (!required.has(k)) {
              out.push({ tool, path: path.join("."), message: `missing required '${k}' present in properties.` });
            }
          }
        }
      }
      for (const k of propKeys) {
        const child = (props as Record<string, unknown>)[k];
        validateSchemaNode(tool, child, join(path, `properties.${k}`), strict, out);
      }
    }
  }

  if (type === "array") {
    if (!hasOwn(rec, "items")) {
      out.push({ tool, path: path.join("."), message: `array.items must be specified.` });
    } else {
      validateSchemaNode(tool, rec["items"], join(path, "items"), strict, out);
    }
  }

  // Allow enum/const but do not recurse into primitives
}

/**
 * Validates a single tool's `parameters` schema against our allowed subset.
 * - Disallows JSON Schema composition keywords.
 * - Enforces object.additionalProperties:false and required includes all properties when strict.
 * - Ensures array.items is present and validated.
 */
export function validateToolSpec(tool: ToolSpec): ValidationResult {
  const errors: ValidationIssue[] = [];
  const strict = (tool as { strict?: boolean }).strict === true;
  const params = (tool as { parameters?: unknown }).parameters;
  if (!params || typeof params !== "object") {
    errors.push({ tool: tool.name, path: "parameters", message: `must be an object schema` });
  } else {
    validateSchemaNode(tool.name, params, ["parameters"], strict, errors);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validates all provided tool specs and aggregates any issues.
 */
export function validateAllTools(tools: ToolSpec[]): ValidationResult {
  const all: ValidationIssue[] = [];
  for (const t of tools) {
    const r = validateToolSpec(t);
    all.push(...r.errors);
  }
  return { ok: all.length === 0, errors: all };
}
