/**
 * @file Types for WebDAV client dialect policies.
 */

export type DialectContext = {
  method: string;
  path: string;
  /** Normalized user-agent string (may be empty). */
  userAgent: string;
  /** Lookup function for headers; returns first matching or empty string. */
  getHeader: (name: string) => string;
};

export type DialectPolicy = {
  /**
   * Allows a policy to directly decide Depth handling for directory MOVE/COPY-like ops.
   * Implementations may fully absorb a client's dialect (return true), defer to the
   * default RFC check (call defaultCheck), or reject (return false).
   */
  ensureDepthOkForDirOps(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean>;
  /**
   * Allows a policy to decide whether to enforce lock tokens on PROPPATCH.
   * Some clients (e.g., Microsoft Office) have been observed to omit lock tokens
   * on property updates. Policies may choose to absorb this and return true.
   */
  ensureLockOkForProppatch(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean>;
};

/** Creates a policy that never relaxes any behavior. */
export function strictDialect(): DialectPolicy {
  return {
    async ensureDepthOkForDirOps(_ctx, defaultCheck) {
      return await defaultCheck();
    },
    async ensureLockOkForProppatch(_ctx, defaultCheck) {
      return await defaultCheck();
    },
  };
}

/** OR-composes multiple dialect policies. Returns true if any policy says true. */
export function composeDialects(list: DialectPolicy[]): DialectPolicy {
  return {
    async ensureDepthOkForDirOps(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean> {
      for (const p of list) {
        const ok = await p.ensureDepthOkForDirOps(ctx, async () => Promise.resolve(false));
        if (ok) { return true; }
      }
      return await defaultCheck();
    },
    async ensureLockOkForProppatch(ctx: DialectContext, defaultCheck: () => Promise<boolean>): Promise<boolean> {
      for (const p of list) {
        const ok = await p.ensureLockOkForProppatch(ctx, async () => Promise.resolve(false));
        if (ok) { return true; }
      }
      return await defaultCheck();
    },
  };
}
