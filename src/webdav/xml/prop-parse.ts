/**
 * @file Minimal XML property parser for WebDAV prop blocks.
 * Parses <...:prop> ... </...:prop> and extracts immediate child elements as key/value pairs.
 * Keys are kept with prefixes (e.g., D:displayname or Z:color) and values are innerText.
 */

/**
 * Parse a WebDAV <prop> block and return a map of immediate child elements.
 * Superficially it looks like generic XML parsing; actually it deliberately
 * ignores namespaces and only extracts direct child tag names and their text.
 */
export function parsePropElements(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!xml || xml.trim().length === 0) { return out; }
  const m = /<\s*[^>]*prop[^>]*>([\s\S]*?)<\s*\/\s*[^>]*prop\s*>/i.exec(xml);
  if (!m) { return out; }
  const inner = m[1] ?? "";
  for (const t of inner.matchAll(/<\s*([A-Za-z0-9_:.-]+)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/g)) {
    const k = (t[1] ?? "").trim();
    const v = (t[2] ?? "").trim();
    if (!k) { continue; }
    out[k] = v;
  }
  for (const t of inner.matchAll(/<\s*([A-Za-z0-9_:.-]+)[^>]*\/>/g)) {
    const k = (t[1] ?? "").trim();
    if (!k) { continue; }
    if (!(k in out)) { out[k] = ""; }
  }
  return out;
}
