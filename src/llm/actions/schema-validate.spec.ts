/**
 * @file Validates tool schemas adhere to OpenAI-compatible subset.
 */
import { getOpenAIToolsSpec } from "./index";
import { validateAllTools } from "./schema-validate";

describe("LLM tool schema validation", () => {
  it("should not use disallowed JSON Schema features", () => {
    const tools = getOpenAIToolsSpec();
    const res = validateAllTools(tools);
    // If failing, this surfaces the exact path/tool and reason.
    // This guards against runtime 400s like: 'oneOf is not permitted' or missing required keys under strict.
    if (!res.ok) {
      const messages = res.errors.map((e) => `${e.tool}: ${e.path} -> ${e.message}`).join("\n");
      // Fail with a helpful aggregated message
      expect(res.ok, messages).toBe(true);
    } else {
      expect(res.ok).toBe(true);
    }
  });
});
