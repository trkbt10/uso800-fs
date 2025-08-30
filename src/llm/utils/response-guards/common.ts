/**
 * @file Common utilities for response event type guards.
 */

/**
 * Type guard to check if an object has a specific property with a specific value.
 */
export function hasTypeProp<T extends string>(obj: unknown, type: T): obj is { type: T } {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  if (!("type" in obj)) {
    return false;
  }
  const t = (obj as Record<string, unknown>).type;
  return t === type;
}

/**
 * Helper to check if a value is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

/**
 * Helper to check if a value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Helper to check if a value is an object (non-null).
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Helper to safely cast to Record<string, unknown>.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}