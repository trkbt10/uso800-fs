/**
 * @file Minimal parser for Extended MKCOL XML bodies.
 * Superficially parses <mkcol><set><prop>… blocks and extracts immediate child elements
 * as key/value pairs using parsePropElements. If body is empty or Content-Type is not XML,
 * returns null to let the caller decide on 415 handling.
 */
import { parsePropElements } from "./prop-parse";

/**
 * Parse MKCOL XML body and return props map or null when not applicable.
 */
export function parseMkcolProps(bodyText: string, contentType: string): Record<string, string> | null {
  if (!bodyText || bodyText.length === 0) { return null; }
  if (!contentType.toLowerCase().includes("xml")) { return null; }
  const mkcol = /<\s*[^>]*mkcol[^>]*>([\s\S]*?)<\s*\/\s*[^>]*mkcol\s*>/i.exec(bodyText);
  const segment = mkcol ? (mkcol[1] ?? "") : bodyText;
  const setBlock = /<\s*[^>]*set[^>]*>([\s\S]*?)<\s*\/\s*[^>]*set\s*>/i.exec(segment);
  const scope = setBlock ? (setBlock[1] ?? "") : segment;
  const props = parsePropElements(scope);
  return Object.keys(props).length > 0 ? props : {};
}

