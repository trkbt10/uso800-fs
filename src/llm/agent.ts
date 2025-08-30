/**
 * FS LLM Agent: consumes a mock Responses API stream and applies validated tool payloads to FS state.
 */
import type { FsState } from "../fakefs/state";
import { ensureDir, putFile, removeEntry, moveEntry, copyEntry } from "../fakefs/state";
import { validateToolPayload, type ToolName } from "./validator";
import { runToolCallStreaming } from "../../../src/services/usodb-llm/utils/response-stream";

// Minimal client surface; compatible with mock streams.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- allow real OpenAI client or mock
type ClientLike = { responses: { stream: any } };

function toolsSpec() {
  return [
    { type: "function", name: "create_dir", strict: true },
    { type: "function", name: "create_file", strict: true },
    { type: "function", name: "write_file", strict: true },
    { type: "function", name: "remove_entry", strict: true },
    { type: "function", name: "move_entry", strict: true },
    { type: "function", name: "copy_entry", strict: true },
    { type: "function", name: "emit_fs_listing", strict: true },
    { type: "function", name: "emit_file_content", strict: true },
  ];
}

export function createFsAgent(client: ClientLike, args: { model: string; state: FsState; instruction?: string }) {
  async function applyTool(name: ToolName, params: Record<string, unknown>) {
    const v = validateToolPayload(name, params);
    if (!v.ok) {
      throw new Error(`invalid payload for ${name}: ${JSON.stringify(v.errors)}`);
    }
    if (name === "create_dir") {
      ensureDir(args.state, (params.path as string[]) ?? []);
      return undefined;
    }
    if (name === "create_file" || name === "write_file") {
      const p = (params.path as string[]) ?? [];
      const content = String(params.content ?? "");
      const mime = typeof params.mime === "string" ? params.mime : undefined;
      putFile(args.state, p, content, mime);
      return undefined;
    }
    if (name === "remove_entry") {
      removeEntry(args.state, (params.path as string[]) ?? []);
      return undefined;
    }
    if (name === "move_entry") {
      moveEntry(args.state, (params.from as string[]) ?? [], (params.to as string[]) ?? []);
      return undefined;
    }
    if (name === "copy_entry") {
      copyEntry(args.state, (params.from as string[]) ?? [], (params.to as string[]) ?? []);
      return undefined;
    }
    if (name === "emit_fs_listing") {
      const folder = (params.folder as string[]) ?? [];
      const entries = Array.isArray(params.entries) ? (params.entries as Array<Record<string, unknown>>) : [];
      ensureDir(args.state, folder);
      for (const e of entries) {
        if (e.kind === "dir") {
          ensureDir(args.state, [...folder, String(e.name ?? "dir")]);
        } else if (e.kind === "file") {
          putFile(
            args.state,
            [...folder, String(e.name ?? "file")],
            String(e.content ?? ""),
            typeof e.mime === "string" ? e.mime : undefined,
          );
        }
      }
      return undefined;
    }
    if (name === "emit_file_content") {
      const path = (params.path as string[]) ?? [];
      const content = String(params.content ?? "");
      const mime = typeof params.mime === "string" ? params.mime : undefined;
      putFile(args.state, path, content, mime);
      return undefined;
    }
    return undefined;
  }

  async function runWithMock(prompt: string) {
    // Note: in tests, client.responses.stream is mocked to yield a single function_call
    await runToolCallStreaming<void>(
      await client.responses.stream({
        model: args.model,
        instructions: args.instruction,
        input: [{ role: "user", content: prompt }],
        tools: toolsSpec(),
        tool_choice: "required",
      }),
      ({ name, params }) => {
        if (!name) return undefined;
        return applyTool(name as ToolName, params);
      },
      { endAfterFirst: true },
    );
  }

  return { runWithMock };
}
