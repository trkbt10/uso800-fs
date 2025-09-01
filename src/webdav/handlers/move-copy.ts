/**
 * @file MOVE/COPY handlers (pure functions)
 */
import type { HandlerOptions, HandlerResult } from "../../webdav/handlers/types";
import { pathToSegments } from "../../utils/path-utils";
import { mapErrorToDav } from "../errors";

async function performMoveCopy(op: "move" | "copy", fromPath: string, destPath: string, options: HandlerOptions & { overwrite?: boolean }): Promise<HandlerResult> {
  const { persist, logger, overwrite } = options;
  const from = pathToSegments(fromPath);
  const to = pathToSegments(destPath);
  const log = (status: number) => {
    if (op === "move") { logger?.logMove(fromPath, destPath, status); return; }
    logger?.logCopy(fromPath, destPath, status);
  };
  try {
    const exists = await persist.exists(from);
    if (!exists) { log(404); return { response: { status: 404 } }; }
    if (to.length > 1) { await persist.ensureDir(to.slice(0, -1)); }
    const destExists = await persist.exists(to);
    const allowOverwrite = overwrite !== false;
    if (destExists && !allowOverwrite) { log(412); return { response: { status: 412 } }; }
    if (destExists && allowOverwrite) {
      await persist.remove(to, { recursive: true });
      if (op === "move") { await persist.move(from, to); } else { await persist.copy(from, to); }
      log(204); return { response: { status: 204 } };
    }
    if (op === "move") { await persist.move(from, to); } else { await persist.copy(from, to); }
    log(201); return { response: { status: 201 } };
  } catch (err) {
    const mapped = mapErrorToDav(err);
    log(mapped.status);
    return { response: { status: mapped.status } };
  }
}

/**
 * Handle MOVE.
 */
export async function handleMoveRequest(fromPath: string, destPath: string, options: HandlerOptions & { overwrite?: boolean }): Promise<HandlerResult> {
  options.logger?.logInput("MOVE", fromPath, { destination: destPath });
  return performMoveCopy("move", fromPath, destPath, options);
}

/**
 * Handle COPY.
 */
export async function handleCopyRequest(fromPath: string, destPath: string, options: HandlerOptions & { overwrite?: boolean }): Promise<HandlerResult> {
  options.logger?.logInput("COPY", fromPath, { destination: destPath });
  return performMoveCopy("copy", fromPath, destPath, options);
}
