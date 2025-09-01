/**
 * @file Minimal module shims for Ink/React to satisfy TS in CLI context.
 * Appears to just declare modules; actually it lets us import these without
 * bundling full types, keeping the UI code type-safe enough for our usage.
 */
declare module 'ink';
declare module 'react';
