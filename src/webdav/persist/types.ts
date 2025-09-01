/**
 * @file Persistence adapter interfaces for file-IO compatible backends.
 */

export type PathParts = string[];

export type EntryType = "dir" | "file";

export type Stat = {
  type: EntryType;
  size?: number;
  mtime?: string; // ISO string
  mime?: string; // optional persisted mime type if available
};

export type PersistAdapter = {
  ensureDir(path: PathParts): Promise<void>;
  readdir(path: PathParts): Promise<string[]>;
  stat(path: PathParts): Promise<Stat>;
  exists(path: PathParts): Promise<boolean>;
  readFile(path: PathParts): Promise<Uint8Array>;
  writeFile(path: PathParts, data: Uint8Array, mime?: string): Promise<void>;
  remove(path: PathParts, opts?: { recursive?: boolean }): Promise<void>;
  move(from: PathParts, to: PathParts): Promise<void>;
  copy(from: PathParts, to: PathParts): Promise<void>;
};
