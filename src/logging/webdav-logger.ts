/**
 * @file WebDAV I/O operation logger for tracking filesystem operations.
 */

export type WebDAVOperation = {
  type: "OPTIONS" | "PROPFIND" | "MKCOL" | "GET" | "HEAD" | "PUT" | "DELETE" | "MOVE" | "COPY";
  path: string;
  timestamp: string;
  status?: number;
  details?: Record<string, unknown>;
};

export type WebDAVLogger = {
  logInput(method: string, path: string, details?: Record<string, unknown>): void;
  logOutput(method: string, path: string, status: number, details?: Record<string, unknown>): void;
  logOperation(op: WebDAVOperation): void;
  logRead(path: string, status: number, size?: number): void;
  logWrite(path: string, status: number, size?: number): void;
  logList(path: string, status: number, itemCount?: number): void;
  logCreate(path: string, status: number, isDir: boolean): void;
  logDelete(path: string, status: number): void;
  logMove(from: string, to: string, status: number): void;
  logCopy(from: string, to: string, status: number): void;
};

/**
 * Creates a WebDAV logger that outputs to console with structured format.
 */
import type { Tracker } from "./tracker";
import { createConsoleTracker } from "./tracker";

export function createWebDAVLogger(tracker?: Tracker): WebDAVLogger {
  const sink: Tracker = tracker ?? createConsoleTracker("[WebDAV]");

  function log(direction: "IN" | "OUT", message: string, details?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, direction, message, ...details };
    sink.track("webdav", logEntry);
  }

  return {
    logInput(method: string, path: string, details?: Record<string, unknown>): void {
      log("IN", `${method} ${path}`, {
        method,
        path,
        ...details,
      });
    },

    logOutput(method: string, path: string, status: number, details?: Record<string, unknown>): void {
      log("OUT", `${method} ${path}`, {
        method,
        path,
        status,
        ...details,
      });
    },

    logOperation(op: WebDAVOperation): void {
      log("OUT", `${op.type} ${op.path}`, {
        type: op.type,
        path: op.path,
        status: op.status,
        ...op.details,
      });
    },

    logRead(path: string, status: number, size?: number): void {
      const entry = { operation: "READ", path, status, size } as const;
      log("OUT", `READ ${path}`, entry as unknown as Record<string, unknown>);
      sink.track("fs.read", entry);
    },

    logWrite(path: string, status: number, size?: number): void {
      const entry = { operation: "WRITE", path, status, size } as const;
      log("OUT", `WRITE ${path}`, entry as unknown as Record<string, unknown>);
      sink.track("fs.write", entry);
    },

    logList(path: string, status: number, itemCount?: number): void {
      const entry = { operation: "LIST", path, status, itemCount } as const;
      log("OUT", `LIST ${path}`, entry as unknown as Record<string, unknown>);
      sink.track("fs.list", entry);
    },

    logCreate(path: string, status: number, isDir: boolean): void {
      const entry = { operation: "CREATE", path, status, type: isDir ? "directory" : "file" } as const;
      log("OUT", `CREATE ${path}`, entry as unknown as Record<string, unknown>);
      sink.track("fs.create", entry);
    },

    logDelete(path: string, status: number): void {
      log("OUT", `DELETE ${path}`, {
        operation: "DELETE",
        path,
        status,
      });
    },

    logMove(from: string, to: string, status: number): void {
      log("OUT", `MOVE ${from} -> ${to}`, {
        operation: "MOVE",
        from,
        to,
        status,
      });
    },

    logCopy(from: string, to: string, status: number): void {
      log("OUT", `COPY ${from} -> ${to}`, {
        operation: "COPY",
        from,
        to,
        status,
      });
    },
  };
}
