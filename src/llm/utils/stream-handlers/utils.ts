/**
 * @file Utility functions for stream handlers.
 */

import { isObject } from "../response-guards/common";

/**
 * Safely parse JSON string to object.
 */
export function safeParseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const obj = JSON.parse(text);
    if (!isObject(obj)) {
      return undefined;
    }
    return obj;
  } catch {
    return undefined;
  }
}

/**
 * Check if async iterable has an abort method.
 */
export function hasAbort(x: AsyncIterable<unknown>): x is AsyncIterable<unknown> & { abort: () => unknown } {
  const anyObj = x as { abort?: unknown };
  return typeof anyObj.abort === "function";
}
