/**
 * @file Request utilities for header handling and conversions.
 * These helpers expose explicit, predictable behavior rather than relying on
 * implicit iteration semantics on Headers, to reduce surprises across runtimes.
 */

/**
 * Convert a Fetch Headers object to a plain Record. Header names are kept as-is.
 */
export function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of h.entries()) {
    out[k] = v;
  }
  return out;
}
