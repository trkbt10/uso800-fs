/**
 * @file MOVE/COPY handlers (pure functions)
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { pathToSegments } from "../../llm/utils/path-utils";

/**
 * Handle MOVE.
 */
export async function handleMoveRequest(fromPath: string, destPath: string, options: HandlerOptions & { overwrite?: boolean }): Promise<HandlerResult> {
  const { persist, logger, overwrite } = options;
  logger?.logInput("MOVE", fromPath, { destination: destPath });
  const from = pathToSegments(fromPath);
  const to = pathToSegments(destPath);
  try {
    const exists = await persist.exists(from);
    if (!exists) {
      logger?.logMove(fromPath, destPath, 404);
      return { response: { status: 404 } };
    }
    if (to.length > 1) {
      await persist.ensureDir(to.slice(0, -1));
    }
    const destExists = await persist.exists(to);
    const allowOverwrite = overwrite !== false;
    if (destExists && !allowOverwrite) {
      logger?.logMove(fromPath, destPath, 412);
      return { response: { status: 412 } };
    }
    if (destExists && allowOverwrite) {
      await persist.remove(to, { recursive: true });
      await persist.move(from, to);
      logger?.logMove(fromPath, destPath, 204);
      return { response: { status: 204 } };
    }
    await persist.move(from, to);
    logger?.logMove(fromPath, destPath, 201);
    return { response: { status: 201 } };
  } catch {
    logger?.logMove(fromPath, destPath, 500);
    return { response: { status: 500 } };
  }
}

/**
 * Handle COPY.
 */
export async function handleCopyRequest(fromPath: string, destPath: string, options: HandlerOptions & { overwrite?: boolean }): Promise<HandlerResult> {
  const { persist, logger, overwrite } = options;
  logger?.logInput("COPY", fromPath, { destination: destPath });
  const from = pathToSegments(fromPath);
  const to = pathToSegments(destPath);
  try {
    const exists = await persist.exists(from);
    if (!exists) {
      logger?.logCopy(fromPath, destPath, 404);
      return { response: { status: 404 } };
    }
    if (to.length > 1) {
      await persist.ensureDir(to.slice(0, -1));
    }
    const destExists = await persist.exists(to);
    const allowOverwrite = overwrite !== false;
    if (destExists && !allowOverwrite) {
      logger?.logCopy(fromPath, destPath, 412);
      return { response: { status: 412 } };
    }
    if (destExists && allowOverwrite) {
      await persist.remove(to, { recursive: true });
      await persist.copy(from, to);
      logger?.logCopy(fromPath, destPath, 204);
      return { response: { status: 204 } };
    }
    await persist.copy(from, to);
    logger?.logCopy(fromPath, destPath, 201);
    return { response: { status: 201 } };
  } catch {
    logger?.logCopy(fromPath, destPath, 500);
    return { response: { status: 500 } };
  }
}
