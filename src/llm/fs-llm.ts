/**
 * @file LLM orchestrator that works directly with PersistAdapter.
 */
import type { PersistAdapter } from "../webdav/persist/types";
import type { Tracker } from "../logging/tracker";
// JSON streaming path removed in favor of tool calls
import type OpenAI from "openai";
import type { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import type { Responses } from "openai/resources/responses/responses";
// Orchestrator entry; implementations are split per feature
import type { ImageGenerationProvider, ImageKind, ImageGenerationRequest, ImageSize } from "../image-generation/types";
// image processing helpers are externalized
import type { FsExecDeps } from "./executors/fs-actions";
import { fabricateListingImpl } from "./orchestrator/fabricate-listing";
import { fabricateFileImpl } from "./orchestrator/fabricate-file";

// Tool schema-based JSON output: no tool selection required

// ensureAsyncIterable removed – we operate on AsyncIterable streams explicitly

/**
 * Minimal OpenAI client interface for Responses API.
 */
export type OpenAIResponsesClient = {
  responses: {
    stream: (
      body: ResponseStreamParams,
      options?: OpenAI.RequestOptions,
    ) => AsyncIterable<Responses.ResponseStreamEvent> | Promise<AsyncIterable<Responses.ResponseStreamEvent>>;
  };
};

function keyOf(parts: string[]): string {
  if (!Array.isArray(parts)) {
    return "/";
  }
  return "/" + parts.filter((p) => p !== "" && p !== "/").join("/");
}

/**
 * Creates a persist-backed LLM orchestrator. Requires an OpenAI client with
 * Responses API, the target model name, optional instruction, and a PersistAdapter
 * for applying tool effects (dirs/files creation and file writes).
 */
export function createUsoFsLLMInstance(
  client: OpenAIResponsesClient,
  args: {
    model: string;
    instruction?: string;
    textInstruction?: string;
    imageInstruction?: string;
    persist: PersistAdapter;
    tracker?: Tracker;
    image?: {
      provider: ImageGenerationProvider;
      repoId: string | number;
      kind: ImageKind;
      request: Omit<ImageGenerationRequest, "sizes"> & { sizes: ImageSize[] };
    };
  },
) {
  if (!client || !client.responses || typeof client.responses.stream !== "function") {
    throw new Error("client.responses.stream is required");
  }
  if (!args || !args.model || !args.persist) {
    throw new Error("model and persist are required");
  }

  // In-flight coalescing to avoid duplicate LLM runs for the same target
  const inflight: { listing: Map<string, Promise<void>>; file: Map<string, Promise<void>> } = {
    listing: new Map<string, Promise<void>>(),
    file: new Map<string, Promise<void>>(),
  };

  function withCoalescing<T>(map: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
    const existing = map.get(key);
    if (existing) {
      return existing;
    }
    const p = run().finally(() => {
      map.delete(key);
    });
    map.set(key, p);
    return p;
  }

  const execDeps: FsExecDeps = { persist: args.persist, image: args.image };

  async function fabricateListing(folderPath: string[], options?: { depth?: string | null }): Promise<void> {
    return fabricateListingImpl(
      {
        client,
        model: args.model,
        instruction: args.instruction,
        textInstruction: args.textInstruction,
        imageInstruction: args.imageInstruction,
        tracker: args.tracker,
        execDeps,
        withCoalescing,
        inflight: inflight.listing,
        keyOf,
      },
      folderPath,
      options,
    );
  }

  /**
   * Notification: request LLM to create/update a file; side-effects are applied via PersistAdapter.
   */
  async function fabricateFileContent(pathParts: string[], options?: { mimeHint?: string }): Promise<void> {
    return fabricateFileImpl(
      {
        client,
        model: args.model,
        instruction: args.instruction,
        textInstruction: args.textInstruction,
        imageInstruction: args.imageInstruction,
        tracker: args.tracker,
        execDeps,
        withCoalescing,
        inflight: inflight.file,
        keyOf,
      },
      pathParts,
      options,
    );
  }

  return { fabricateListing, fabricateFileContent };
}
