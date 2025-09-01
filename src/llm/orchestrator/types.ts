/**
 * @file Shared orchestrator dependency types to avoid repetition.
 */
import type { Tracker } from "../../logging/tracker";
import type { OpenAIResponsesClient } from "../fs-llm";
import type { FsExecDeps } from "../executors/fs-actions";

/** Function type for in-flight coalescing. */
export type WithCoalescingFn = <T>(map: Map<string, Promise<T>>, key: string, run: () => Promise<T>) => Promise<T>;

/**
 * Common fields required by orchestrator implementations (listing/file).
 */
export type OrchestratorBaseDeps = {
  client: OpenAIResponsesClient;
  model: string;
  instruction?: string;
  textInstruction?: string;
  imageInstruction?: string;
  tracker?: Tracker;
  execDeps: FsExecDeps;
  withCoalescing: WithCoalescingFn;
  keyOf: (parts: string[]) => string;
};

/**
 * Dependencies specialized for listing fabrication (inflight<void>).
 */
export type ListingDeps = OrchestratorBaseDeps & { inflight: Map<string, Promise<void>> };

/**
 * Dependencies specialized for file fabrication (inflight<string>).
 */
export type FileDeps = OrchestratorBaseDeps & { inflight: Map<string, Promise<string>> };

