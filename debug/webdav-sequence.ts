/**
 * @file WebDAV sequence driver for a running server (127.0.0.1:8787 by default).
 * Sends a series of PROPFIND/GET/PUT/MKCOL requests to exercise LLM auto-generation.
 * Run: bun run debug/webdav-sequence.ts [baseURL]
 */
import { createClient } from "webdav";

async function main() {
  const base = (process.argv[2] as string | undefined) ?? process.env.WEBDAV_BASE ?? "http://127.0.0.1:8787";
  const client = createClient(base);

  function log(label: string, data: unknown): void {
    console.log(`[DEBUG] ${label} ${JSON.stringify(data)}`);
  }

  // 0) First-boot: wait for initial root listing fabricated at startup
  async function waitForInitialRoot(timeoutMs: number = 15000, intervalMs: number = 500): Promise<string[]> {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const list = (await client.getDirectoryContents("/")) as Array<{ basename: string }>;
        const items = list.map((i) => i.basename);
        // Return on first successful PROPFIND, even if empty
        return items;
      } catch {
        // ignore until timeout
      }
      if (Date.now() - start > timeoutMs) {
        return [];
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  const initial = await waitForInitialRoot();
  log("BOOTSTRAP /", { items: initial });

  // 1) PROPFIND on non-existent/new folder -> should fabricate listing
  try {
    const list1 = (await client.getDirectoryContents("/newdir/")) as Array<{ basename: string }>;
    log("PROPFIND /newdir/", { items: list1.map((i) => i.basename) });
  } catch (e) {
    log("PROPFIND /newdir/ error", { error: String(e) });
  }

  // 2) GET on non-existent file -> fabricate content
  try {
    const t = (await client.getFileContents("/hello.txt", { format: "text" })) as string;
    log("GET /hello.txt", { text: t });
  } catch (e) {
    log("GET /hello.txt error", { error: String(e) });
  }

  // 3) PUT empty -> fabricate content, then GET
  try {
    await client.putFileContents("/empty.txt", Buffer.from([]));
    const t2 = (await client.getFileContents("/empty.txt", { format: "text" })) as string;
    log("PUT+GET /empty.txt", { text: t2 });
  } catch (e) {
    log("PUT/GET /empty.txt error", { error: String(e) });
  }

  // 4) MKCOL then PROPFIND -> fabricate listing for empty dir
  try {
    await client.createDirectory("/blank");
    const list2 = (await client.getDirectoryContents("/blank/")) as Array<{ basename: string }>;
    log("MKCOL+PROPFIND /blank/", { items: list2.map((i) => i.basename) });
  } catch (e) {
    log("MKCOL/PROPFIND /blank/ error", { error: String(e) });
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
