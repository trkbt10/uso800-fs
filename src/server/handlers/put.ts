/**
 * @file PUT handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import { handlePut as webdavPut } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";
import type { WebDavHooks } from "../../webdav/hooks";

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

  let data = initial;
  let contentType: string | undefined = undefined;
  const setBody = (next: Uint8Array, ct?: string) => { data = next; contentType = ct; };
  // Hook can mutate body or short-circuit
  const maybe = await (async (h: WebDavHooks | undefined) => {
    if (!h?.beforePut) { return undefined; }
    try {
      return await h.beforePut({ urlPath, segments, body: data, setBody, persist, logger });
    } catch {
      return undefined;
    }
  })(hooks);

  if (maybe) {
    return { response: maybe };
  }
  const response = await webdavPut(persist, urlPath, data, contentType, logger);
  return { response };
}
