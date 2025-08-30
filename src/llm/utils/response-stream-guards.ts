/**
 * @file Re-exports type guards from response-guards folder for backward compatibility.
 * 
 * This file maintains backward compatibility by re-exporting the guards from
 * the modular response-guards files. New code should import directly from
 * response-guards/index.ts instead.
 * 
 * @deprecated Use imports from './response-guards' instead
 */

// Re-export all guards from the centralized location
export {
  // Common utilities
  hasTypeProp,
  isNumber,
  isString,
  isObject,
  asRecord,
  
  // Core response events
  isResponseStreamEvent,
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
  
  // Function call events
  isArgsDeltaEvent,
  isArgsDoneEvent,
  isFunctionCallItem,
  extractOutputItem,
  
  // Text events
  isTextDeltaEvent,
  isTextDoneEvent,
} from "./response-guards";