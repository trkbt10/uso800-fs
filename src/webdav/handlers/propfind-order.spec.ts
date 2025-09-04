import { createMemoryAdapter } from "../persist/memory";
import { setOrder } from "../order";
import { handlePropfindRequest } from "./propfind";

async function textOf(res: { response: { body?: string | Uint8Array } }): Promise<string> {
  const b = res.response.body;
  if (typeof b === "string") { return b; }
  if (b instanceof Uint8Array) { return new TextDecoder().decode(b); }
  return "";
}

describe("PROPFIND ordering", () => {
  it("applies order file to depth=1 children", async () => {
    const base = createMemoryAdapter();
    await base.ensureDir(["folder"]);
    await base.writeFile(["folder","a.txt"], new TextEncoder().encode("a"), "text/plain");
    await base.writeFile(["folder","b.txt"], new TextEncoder().encode("b"), "text/plain");
    await base.writeFile(["folder","c.txt"], new TextEncoder().encode("c"), "text/plain");
    await setOrder(base, "/folder", ["c.txt","a.txt","b.txt"]);
    const r = await handlePropfindRequest("/folder", "1", { persist: base });
    const xml = await textOf(r);
    const idxC = xml.indexOf(">c.txt<");
    const idxA = xml.indexOf(">a.txt<");
    const idxB = xml.indexOf(">b.txt<");
    expect(idxC).toBeGreaterThan(0);
    expect(idxC).toBeLessThan(idxA);
    expect(idxA).toBeLessThan(idxB);
  });
});

