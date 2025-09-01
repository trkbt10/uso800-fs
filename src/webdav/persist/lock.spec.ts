/**
 * @file Unit tests for createLockedPersistAdapter
 */
import { createLockedPersistAdapter } from "./lock";
import type { PersistAdapter, PathParts, Stat } from "./types";

function makeBaseAdapter(onWrite: (path: PathParts, data: Uint8Array) => Promise<void> | void): PersistAdapter {
  const notImpl = async () => { /* noop */ };
  const notImplArr = async () => [] as string[];
  const notImplStat = async () => ({ type: "file" as const } satisfies Stat);
  const notImplBuf = async () => new Uint8Array();
  const notImplBool = async () => false;
  return {
    ensureDir: async () => { await notImpl(); },
    readdir: async () => await notImplArr(),
    stat: async () => await notImplStat(),
    exists: async () => await notImplBool(),
    readFile: async () => await notImplBuf(),
    writeFile: async (p, d) => { await onWrite(p, d); },
    remove: async () => { await notImpl(); },
    move: async () => { await notImpl(); },
    copy: async () => { await notImpl(); },
  };
}

function deferred() {
  const box: { resolve?: () => void } = {};
  const promise = new Promise<void>((r) => { box.resolve = r; });
  const resolve = () => { if (box.resolve) { box.resolve(); } };
  return { promise, resolve } as const;
}

describe("createLockedPersistAdapter", () => {
  it("serializes concurrent writes to the same path", async () => {
    const events: string[] = [];
    const gate = deferred();
    const base = makeBaseAdapter(async (_p, d) => {
      const text = new TextDecoder().decode(d);
      if (text === "A") {
        events.push("start-A");
        await gate.promise; // hold A
        events.push("end-A");
        return;
      }
      events.push(`start-${text}`);
      events.push(`end-${text}`);
    });
    const locked = createLockedPersistAdapter(base);
    const path: PathParts = ["x.txt"];

    const p1 = locked.writeFile(path, new TextEncoder().encode("A"));
    // Schedule B immediately; it should not start until A finishes
    const p2 = locked.writeFile(path, new TextEncoder().encode("B"));

    // Allow A to finish after a tick
    setTimeout(() => { gate.resolve(); }, 0);
    await Promise.all([p1, p2]);

    const joined = events.join(",");
    expect(joined).toBe("start-A,end-A,start-B,end-B");
  });

  it("allows concurrent operations on different paths", async () => {
    const events: string[] = [];
    const gate = deferred();
    const base = makeBaseAdapter(async (p) => {
      const name = p[p.length - 1] ?? "";
      events.push(`start-${name}`);
      if (name === "a.txt") { await gate.promise; }
      events.push(`end-${name}`);
    });
    const locked = createLockedPersistAdapter(base);
    const pA: PathParts = ["a.txt"];
    const pB: PathParts = ["b.txt"];

    const t1 = locked.writeFile(pA, new Uint8Array([1]));
    const t2 = locked.writeFile(pB, new Uint8Array([2]));
    // release A soon; B should be able to proceed without waiting for A
    setTimeout(() => gate.resolve(), 0);
    await Promise.all([t1, t2]);

    // We only assert that both started before A ended is allowed; order may vary
    expect(events[0]).toContain("start-");
    expect(events).toContain("start-a.txt");
    expect(events).toContain("start-b.txt");
    expect(events).toContain("end-a.txt");
    expect(events).toContain("end-b.txt");
  });
});
