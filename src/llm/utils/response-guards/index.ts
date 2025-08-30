/**
 * @file Comprehensive type guards for all OpenAI Responses API stream events.
 * 
 * This module provides type guards for all ResponseStreamEvent types,
 * organized by category for better maintainability.
 */

// Re-export common utilities
export * from "./common";

// Audio events
export {
  isAudioDeltaEvent,
  isAudioDoneEvent,
  isAudioTranscriptDeltaEvent,
  isAudioTranscriptDoneEvent,
} from "./audio";

// Code interpreter events
export {
  isCodeInterpreterCodeDeltaEvent,
  isCodeInterpreterCodeDoneEvent,
  isCodeInterpreterCompletedEvent,
  isCodeInterpreterInProgressEvent,
  isCodeInterpreterInterpretingEvent,
} from "./code-interpreter";

// Core response events
export {
  isResponseStreamEvent,
  isResponseCreatedEvent,
  isResponseCompletedEvent,
  isResponseInProgressEvent,
  isResponseFailedEvent,
  isResponseIncompleteEvent,
  isResponseErrorEvent,
  isResponseQueuedEvent,
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
} from "./core";

// Content events
export {
  isContentPartAddedEvent,
  isContentPartDoneEvent,
} from "./content";

// File search events
export {
  isFileSearchCompletedEvent,
  isFileSearchInProgressEvent,
  isFileSearchSearchingEvent,
} from "./file-search";

// Function call events
export {
  isArgsDeltaEvent,
  isArgsDoneEvent,
  isFunctionCallItem,
  extractOutputItem,
} from "./function-call";

// Text events
export {
  isTextDeltaEvent,
  isTextDoneEvent,
  isOutputTextAnnotationAddedEvent,
} from "./text";

// Reasoning events
export {
  isReasoningTextDeltaEvent,
  isReasoningTextDoneEvent,
  isReasoningSummaryPartAddedEvent,
  isReasoningSummaryPartDoneEvent,
  isReasoningSummaryTextDeltaEvent,
  isReasoningSummaryTextDoneEvent,
} from "./reasoning";

// Refusal events
export {
  isRefusalDeltaEvent,
  isRefusalDoneEvent,
} from "./refusal";

// Web search events
export {
  isWebSearchCompletedEvent,
  isWebSearchInProgressEvent,
  isWebSearchSearchingEvent,
} from "./web-search";

// Image generation events
export {
  isImageGenCompletedEvent,
  isImageGenGeneratingEvent,
  isImageGenInProgressEvent,
  isImageGenPartialImageEvent,
} from "./image-gen";

// MCP events
export {
  isMcpCallArgumentsDeltaEvent,
  isMcpCallArgumentsDoneEvent,
  isMcpCallCompletedEvent,
  isMcpCallFailedEvent,
  isMcpCallInProgressEvent,
  isMcpListToolsCompletedEvent,
  isMcpListToolsFailedEvent,
  isMcpListToolsInProgressEvent,
} from "./mcp";

// Custom tool call events
export {
  isCustomToolCallInputDeltaEvent,
  isCustomToolCallInputDoneEvent,
} from "./custom-tool";

// Type exports for convenience
export type { Responses } from "openai/resources/responses/responses";