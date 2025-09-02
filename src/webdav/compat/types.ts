/**
 * @file Types for WebDAV client-compatibility sidecar policies.
 */

export type CompatContext = {
  method: string;
  path: string;
  /** Normalized user-agent string (may be empty). */
  userAgent: string;
  /** Lookup function for headers; returns first matching or empty string. */
  getHeader: (name: string) => string;
};

export type CompatPolicy = {
  /**
   * Whether to relax the Depth: infinity requirement for directory MOVE/COPY-like ops.
   * Return true to relax, false to require strict spec handling.
   */
  shouldRelaxDepthForDirOps(ctx: CompatContext): boolean;
};

/** Creates a policy that never relaxes any behavior. */
export function strictPolicy(): CompatPolicy {
  return {
    shouldRelaxDepthForDirOps() {
      return false;
    },
  };
}

/** OR-composes multiple policies. Returns true if any policy says true. */
export function composePolicies(list: CompatPolicy[]): CompatPolicy {
  return {
    shouldRelaxDepthForDirOps(ctx: CompatContext): boolean {
      for (const p of list) {
        if (p.shouldRelaxDepthForDirOps(ctx)) {
          return true;
        }
      }
      return false;
    },
  };
}
