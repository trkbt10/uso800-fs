/**
 * @file PUT handler (pure function)
 */
import { pathToSegments } from "../../llm/utils/path-utils";
import { handlePut as webdavPut } from "../../hono-middleware-webdav/handler";
import type { HandlerOptions, HandlerResult } from "./types";

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
  const { persist, llm, logger } = options;
  const segments = pathToSegments(urlPath);

  const initial = bufferToUint8Array(body);
  logger?.logInput("PUT", urlPath, { size: initial.byteLength });

  const resolved = await (async () => {
    if (initial.byteLength === 0 && llm) {
      try {
        const content = await llm.fabricateFileContent(segments);
        if (content) {
          return { data: new TextEncoder().encode(content), contentType: "text/plain" as const, generated: true as const };
        }
      } catch {
        // fallthrough
      }
    }
    return { data: initial, contentType: undefined, generated: false as const };
  })();

  const response = await webdavPut(persist, urlPath, resolved.data, resolved.contentType, logger);
  if (resolved.generated) {
    return { response, sideEffects: { generated: true, llmCalled: true } };
  }
  return { response };
}
