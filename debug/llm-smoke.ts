/**
 * Minimal smoke run for LLM agent without test runner or forks.
 * Uses the single-export action pattern and a mock Responses stream.
 */
import { createFsState, getEntry } from "../src/fakefs/state";
import { createFsAgent } from "../src/llm/agent";

function mockStream(events: unknown[]): AsyncIterable<unknown> {
  async function* gen() {
    for (const ev of events) {
      yield ev;
    }
  }
  return gen();
}

async function main() {
  const st = createFsState();
  const client = {
    responses: {
      stream: () =>
        mockStream([
          { type: "response.output_item.added", item: { type: "function_call", id: "i1", name: "emit_file_content" } },
          {
            type: "response.function_call.arguments.delta",
            item_id: "i1",
            delta: '{"path":["LLM","note.txt"],"content":"hello from smoke","mime":"text/plain"}',
          },
          { type: "response.function_call.arguments.done", item_id: "i1" },
        ]),
    },
  } as const;

  const agent = createFsAgent(client, { model: "m", state: st });
  await agent.runWithMock("please write content");

  const file = getEntry(st, ["LLM", "note.txt"]);
  if (!file || file.type !== "file") {
    console.error("LLM smoke failed: file not created");
    process.exit(1);
  }
  console.log("OK: ", file.name, String(file.size), "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

