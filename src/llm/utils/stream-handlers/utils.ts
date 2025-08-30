/**
 * @file Utility functions for stream handlers.
 */

/**
 * Check if value is an object.
 */
export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * Safely parse JSON string to object.
 */
export function safeParseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const obj = JSON.parse(text);
    if (!isObject(obj)) {
      return undefined;
    }
    return obj as Record<string, unknown>;
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