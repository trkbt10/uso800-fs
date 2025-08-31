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
export function createWebDAVLogger(): WebDAVLogger {
  function log(direction: "IN" | "OUT", message: string, details?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      direction,
      message,
      ...details,
    };
    console.log(`[WebDAV ${direction}] ${JSON.stringify(logEntry)}`);
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
      log("OUT", `READ ${path}`, {
        operation: "READ",
        path,
        status,
        size,
      });
    },

    logWrite(path: string, status: number, size?: number): void {
      log("OUT", `WRITE ${path}`, {
        operation: "WRITE",
        path,
        status,
        size,
      });
    },

    logList(path: string, status: number, itemCount?: number): void {
      log("OUT", `LIST ${path}`, {
        operation: "LIST",
        path,
        status,
        itemCount,
      });
    },

    logCreate(path: string, status: number, isDir: boolean): void {
      log("OUT", `CREATE ${path}`, {
        operation: "CREATE",
        path,
        status,
        type: isDir ? "directory" : "file",
      });
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