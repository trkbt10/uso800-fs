/**
 * @file PUT handler (pure function)
 */
import { pathToSegments } from "../../utils/path-utils";
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import type { WebDavHooks } from "../../webdav/hooks";
import { mapErrorToDav } from "../errors";

function bufferToUint8Array(body: ArrayBuffer | Uint8Array): Uint8Array {
  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

/**
 * Handle PUT; if body is empty and LLM is available, generate content once.
 */
export async function handlePutRequest(
  urlPath: string,
  body: ArrayBuffer | Uint8Array,
  options: HandlerOptions
): Promise<HandlerResult> {
  const { persist, hooks, logger } = options;
  const segments = pathToSegments(urlPath);

  const initial = bufferToUint8Array(body);
  logger?.logInput("PUT", urlPath, { size: initial.byteLength });

  const state: { data: Uint8Array; contentType: string | undefined } = { data: initial, contentType: undefined };
  const setBody = (next: Uint8Array, ct?: string) => { state.data = next; state.contentType = ct; };
  // Hook can mutate body or short-circuit
  const maybe = await (async (h: WebDavHooks | undefined) => {
    if (!h?.beforePut) { return undefined; }
    try {
      return await h.beforePut({ urlPath, segments, body: state.data, setBody, persist, logger });
    } catch {
      return undefined;
    }
  })(hooks);

  if (maybe) {
    return { response: maybe };
  }
  const parts = pathToSegments(urlPath);
  if (parts.length === 0) {
    return { response: { status: 400 } };
  }
  try {
    if (parts.length > 1) {
      await persist.ensureDir(parts.slice(0, -1));
    }
    await persist.writeFile(parts, state.data, state.contentType);
    logger?.logWrite(urlPath, 201, state.data.length);
    return { response: { status: 201, headers: { "Content-Length": String(state.data.length), "Content-Type": state.contentType ?? "application/octet-stream" } } };
  } catch (err) {
    const mapped = mapErrorToDav(err);
    logger?.logWrite(urlPath, mapped.status);
    return { response: { status: mapped.status } };
  }
}
