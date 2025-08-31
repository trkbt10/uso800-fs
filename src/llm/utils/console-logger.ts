/**
 * @file Console logger for streaming events. Emits JSON lines to stdout.
 */
import type { StreamLogger } from "./stream-handlers";

/**
 * Creates a StreamLogger that writes JSON-serialized entries to console.log.
 * @param prefix Optional prefix string printed before each JSON line
 */
export function createConsoleStreamLogger(prefix?: string): StreamLogger {
  return {
    async write(obj: unknown): Promise<void> {
      const line = JSON.stringify(obj);
      if (typeof prefix === "string" && prefix.length > 0) {
        console.log(prefix + " " + line);
      } else {
        console.log(line);
      }
    },
  };
}

