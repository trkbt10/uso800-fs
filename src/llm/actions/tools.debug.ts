/**
 * Minimal tools schema smoke test using real OpenAI.
 * Requires: OPENAI_API_KEY, OPENAI_MODEL
 */
import OpenAI from "openai";
import type { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import { getOpenAIToolsSpec } from "./tools";

async function runOnce(body: ResponseStreamParams) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const stream = await client.responses.stream(body);
  const iter = (stream as AsyncIterable<unknown>)[Symbol.asyncIterator]();
  await iter.next();
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    throw new Error("OPENAI_API_KEY and OPENAI_MODEL required");
  }

  const tools = getOpenAIToolsSpec();
  const listing: ResponseStreamParams = {
    model,
    instructions: "Return only via function call.",
    input: [{ role: "user", content: "Make 2-4 entries for / (one dir, one file)." }],
    tools: tools.filter((t) => t.name === "emit_fs_listing"),
    tool_choice: { type: "function", name: "emit_fs_listing" },
  };
  const file: ResponseStreamParams = {
    model,
    instructions: "Return only via function call.",
    input: [{ role: "user", content: "Make short text for /debug.txt" }],
    tools: tools.filter((t) => t.name === "emit_file_content"),
    tool_choice: { type: "function", name: "emit_file_content" },
  };

  await runOnce(listing);
  await runOnce(file);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
