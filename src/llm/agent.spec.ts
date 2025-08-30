/**
 * @file Unit: LLM FS agent with JSON Schema validation + mock Responses API stream + WebDAV verification
 */
import { createFsAgent } from "./agent";
import { createFsState, getEntry } from "../fakefs/state";
import { handlePropfind, handleGet } from "../webdav/handler";

function mockStream(events: unknown[]): AsyncIterable<unknown> {
  async function* gen() {
    for (const ev of events) yield ev;
  }
  return gen();
}

describe("uso800fs/llm agent", () => {
  it("validates emit_fs_listing and applies entries", async () => {
    const st = createFsState();
    const client = {
      responses: {
        stream: (_opts: unknown) =>
          mockStream([
            { type: "response.output_item.added", item: { type: "function_call", id: "i1", name: "emit_fs_listing" } },
            {
              type: "response.function_call.arguments.delta",
              item_id: "i1",
              delta:
                '{"folder":["LLM"],"entries":[{"kind":"dir","name":"A"},{"kind":"file","name":"readme.txt","content":"hi","mime":"text/plain"}]}',
            },
            { type: "response.function_call.arguments.done", item_id: "i1" },
          ]),
      },
    };
    const agent = createFsAgent(client as unknown as { responses: { stream: any } }, { model: "m", state: st });
    await agent.runWithMock("please fabricate listing under /LLM");
    // Verify via WebDAV PROPFIND
    const r = handlePropfind(st, "/LLM", "1");
    expect(r.status).toBe(207);
    const body = String(r.body);
    expect(body).toContain("readme.txt");
    expect(body).toContain("A/");
  });

  it("validates emit_file_content and returns via GET", async () => {
    const st = createFsState();
    const client = {
      responses: {
        stream: (_opts: unknown) =>
          mockStream([
            { type: "response.output_item.added", item: { type: "function_call", id: "i1", name: "emit_file_content" } },
            {
              type: "response.function_call.arguments.delta",
              item_id: "i1",
              delta: '{"path":["Files","note.txt"],"content":"Hello LLM","mime":"text/plain"}',
            },
            { type: "response.function_call.arguments.done", item_id: "i1" },
          ]),
      },
    };
    const agent = createFsAgent(client as unknown as { responses: { stream: any } }, { model: "m", state: st });
    await agent.runWithMock("please fabricate content");
    const file = getEntry(st, ["Files", "note.txt"]);
    expect(file && file.type).toBe("file");
    const resp = handleGet(st, "/Files/note.txt");
    expect(resp.status).toBe(200);
    expect(String(resp.body)).toContain("Hello LLM");
  });
});

