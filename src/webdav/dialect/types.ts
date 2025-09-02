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
   * Whether to relax the Depth: infinity requirement for directory MOVE/COPY-like ops.
   * Return true to relax, false to require strict spec handling.
   */
  shouldRelaxDepthForDirOps(ctx: DialectContext): boolean;
};

/** Creates a policy that never relaxes any behavior. */
export function strictDialect(): DialectPolicy {
  return {
    shouldRelaxDepthForDirOps() {
      return false;
    },
  };
}

/** OR-composes multiple dialect policies. Returns true if any policy says true. */
export function composeDialects(list: DialectPolicy[]): DialectPolicy {
  return {
    shouldRelaxDepthForDirOps(ctx: DialectContext): boolean {
      for (const p of list) {
        if (p.shouldRelaxDepthForDirOps(ctx)) {
          return true;
        }
      }
      return false;
    },
  };
}

