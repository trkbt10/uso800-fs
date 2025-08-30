/**
 * @file Unit: uso800fs LLM orchestrator using Responses API streaming (mocked)
 */
import { createUsoFsLLMInstance } from "./fs-llm";
import { createFsState, getEntry } from "../fakefs/state";

function mockStream(events: unknown[]): AsyncIterable<unknown> {
  async function* gen() {
    for (const ev of events) {
      yield ev;
    }
  }
  return gen();
}

describe("uso800fs/llm fs-llm", () => {
  it("fabricateListing applies emit_fs_listing to state", async () => {
    const st = createFsState();
    const client = {
      responses: {
        stream: () =>
          mockStream([
            { type: "response.output_item.added", item: { type: "function_call", id: "i1", name: "emit_fs_listing" } },
            {
              type: "response.function_call.arguments.delta",
              item_id: "i1",
              delta:
                '{"folder":["AI"],"entries":[{"kind":"dir","name":"D"},{"kind":"file","name":"hello.txt","content":"hi","mime":"text/plain"}]}'
            },
            { type: "response.function_call.arguments.done", item_id: "i1" },
          ]),
      },
    };
    const llm = createUsoFsLLMInstance(client, { model: "m", state: st });
    await llm.fabricateListing(["AI"]);
    const file = getEntry(st, ["AI", "hello.txt"]);
    expect(file?.type).toBe("file");
  });

  it("fabricateFileContent returns content and writes file", async () => {
    const st = createFsState();
    const client = {
      responses: {
        stream: () =>
          mockStream([
            { type: "response.output_item.added", item: { type: "function_call", id: "i1", name: "emit_file_content" } },
            {
              type: "response.function_call.arguments.delta",
              item_id: "i1",
              delta: '{"path":["Docs","note.md"],"content":"Hello Files","mime":"text/markdown"}',
            },
            { type: "response.function_call.arguments.done", item_id: "i1" },
          ]),
      },
    };
    const llm = createUsoFsLLMInstance(client, { model: "m", state: st });
    const text = await llm.fabricateFileContent(["Docs", "note.md"]);
    expect(text).toContain("Hello Files");
    const file = getEntry(st, ["Docs", "note.md"]);
    expect(file?.type).toBe("file");
  });
});
