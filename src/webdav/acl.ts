/**
 * @file ACL utilities backed by DavState props store.
 * Supports method-specific allow/deny and privilege-based rules with
 * hierarchical inheritance from parent collections.
 */
import { createDavStateStore } from "./dav-state";
import type { PersistAdapter } from "./persist/types";

function isTrue(val: unknown): boolean {
  if (typeof val !== "string") { return false; }
  const v = val.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type Privilege = "read" | "write";

function methodToPrivilege(method: string): Privilege {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "PROPFIND") { return "read"; }
  return "write";
}

function parseCsv(val: unknown): string[] {
  if (typeof val !== "string") { return []; }
  return val.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}

async function getPropsChain(persist: PersistAdapter, path: string): Promise<Record<string, string>[]> {
  const store = createDavStateStore(persist);
  const parts = path.split("/").filter((p) => p !== "");
  const prefixes = parts.map((_, i) => "/" + parts.slice(0, i + 1).join("/"));
  const paths: string[] = ["/", ...prefixes]; // root first
  const list: Record<string, string>[] = [];
  for (const p of paths) {
    const props = await store.getProps(p);
    list.push(props);
  }
  return list;
}

/**
 * Check if the given HTTP/WebDAV method is allowed for the path.
 * Props conventions (evaluated from root → target):
 *  - `Z:acl-deny-<METHOD>=true` denies
 *  - `Z:acl-allow-<METHOD>=true` allows
 *  - `Z:acl-deny`/`Z:acl-allow` as comma-separated privileges (read,write)
 *  - Deny takes precedence over Allow at any level
 * Default policy: allow when no relevant rules found.
 */
export async function isMethodAllowed(persist: PersistAdapter, path: string, method: string): Promise<boolean> {
  const chain = await getPropsChain(persist, path);
  const methodKeyDeny = `Z:acl-deny-${method.toUpperCase()}`;
  // Retained for future expansion; currently default policy already allows.
  // const methodKeyAllow = `Z:acl-allow-${method.toUpperCase()}`;
  const required = methodToPrivilege(method);

  const hasDeny = chain.some((props) => {
    const rec = props as Record<string, unknown>;
    if (isTrue(rec[methodKeyDeny])) { return true; }
    const denyList = parseCsv(rec["Z:acl-deny"]);
    return denyList.includes(required);
  });
  if (hasDeny) { return false; }

  // Default policy allows when no deny rule matches.
  return true;
}
