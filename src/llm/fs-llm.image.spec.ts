/**
 * @file Unit tests for image generation integration in fs-llm orchestrator.
 */
import { createUsoFsLLMInstance, type OpenAIResponsesClient } from "./fs-llm";
import { createMemoryAdapter } from "../webdav/persist/memory";
import type { Responses } from "openai/resources/responses/responses";
import type { ImageGenerationProvider, ImageKind, ImageGenerationRequest } from "../image-generation/types";

function mockImageProvider(): ImageGenerationProvider {
  return {
    async generate({ request }: { repoId: string | number; kind: ImageKind; prompt: string; request: ImageGenerationRequest }) {
      const s = request.sizes[0];
      const data = Buffer.from("AAA", "base64").toString("base64");
      return { results: [{ size: s, url: `data:image/png;base64,${data}`, moderation: { nsfw: false } }] };
    },
  };
}

describe("fs-llm image generation", () => {
  it("fabricateListing writes image bytes when mime is image/*", async () => {
    const persist = createMemoryAdapter();
    const mockStream = (async function* (): AsyncGenerator<Responses.ResponseStreamEvent> {
      const id = "call1";
      const added: Responses.ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: { type: "function_call", id, name: "emit_fs_listing", arguments: "{}", call_id: "c1" },
        output_index: 0,
        sequence_number: 0,
      };
      const argsDone: Responses.ResponseFunctionCallArgumentsDoneEvent = {
        type: "response.function_call_arguments.done",
        item_id: id,
        output_index: 0,
        sequence_number: 1,
        arguments: JSON.stringify({
          folder: ["img"],
          entries: [ { name: "pic.png", kind: "file", content: "blue square", mime: "image/png" } ],
        }),
      };
      yield added; yield argsDone;
    })();

    const mockClient: OpenAIResponsesClient = { responses: { stream: async () => mockStream } };
    const instance = createUsoFsLLMInstance(mockClient, {
      model: "test",
      persist,
      image: { provider: mockImageProvider(), repoId: "r1", kind: "thumbnail", request: { sizes: [{ w: 64, h: 64 }], style: "flat" } },
    });

    await instance.fabricateListing(["img"]);
    const ok = await persist.exists(["img", "pic.png"]);
    expect(ok).toBe(true);
    const data = await persist.readFile(["img", "pic.png"]);
    // Expect decoded bytes to match base64 AAA
    expect(Buffer.from(data).length).toBe(Buffer.from("AAA", "base64").length);
  });

  it("fabricateFileContent writes image bytes for image mime", async () => {
    const persist = createMemoryAdapter();
    const mockStream = (async function* (): AsyncGenerator<Responses.ResponseStreamEvent> {
      const id = "call2";
      const added: Responses.ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: { type: "function_call", id, name: "emit_image_file", arguments: "{}", call_id: "c2" },
        output_index: 0,
        sequence_number: 0,
      };
      const argsDone: Responses.ResponseFunctionCallArgumentsDoneEvent = {
        type: "response.function_call_arguments.done",
        item_id: id,
        output_index: 0,
        sequence_number: 1,
        arguments: JSON.stringify({ path: ["art.png"], prompt: "red circle", mime: "image/png" }),
      };
      yield added; yield argsDone;
    })();

    const mockClient: OpenAIResponsesClient = { responses: { stream: async () => mockStream } };
    const instance = createUsoFsLLMInstance(mockClient, {
      model: "test",
      persist,
      image: { provider: mockImageProvider(), repoId: "r1", kind: "icon", request: { sizes: [{ w: 32, h: 32 }], style: "flat" } },
    });

    await instance.fabricateFileContent(["art.png"], { mimeHint: "image/png" });
    const ok = await persist.exists(["art.png"]);
    expect(ok).toBe(true);
    const data = await persist.readFile(["art.png"]);
    expect(Buffer.from(data).length).toBe(Buffer.from("AAA", "base64").length);
  });
});
