# Uso800FS (WebDAV fake filesystem)

Hono-based WebDAV adapter that serves a fake, persistent filesystem. It mirrors the patterns used in `src/services/usodb-llm`:

- Fast-path: deterministic responses using in-memory virtual state
- LLM-path: optional orchestration to fabricate directory listings and file contents via tool-calls
- Persistence: snapshot JSON and action log (same approach as usodb-llm)

Note: This folder is not included in the main TypeScript project includes. It references external packages (`hono`) so it won’t affect the root lint/typecheck until you add dependencies. Use Bun to run it.

## Features

- WebDAV endpoints (minimal):
  - OPTIONS: advertise DAV capabilities
  - PROPFIND: list directory contents
  - MKCOL: create a directory; on create, generate mysterious files/folders based on the new name
  - GET: open a file; generates fake content on first open
  - HEAD: metadata
- Virtual FS state with snapshot save/load
- Hooks to integrate an LLM to fabricate listings and content

## Run (example)

1) Install dependencies (hono):

   bun add hono

2) Start the server:

   bun run uso800fs/server.ts --port 8787 --state ./debug/fs-state.json --actions ./debug/fs-actions.jsonl

3) Mount WebDAV (macOS example):

   mount_webdav http://127.0.0.1:8787/ /Volumes/uso800fs

4) Try:

   - Create folder: NewProject
   - Open generated files; contents are fabricated on the fly.

## Layout

- `server.ts` – Hono app + HTTP server + router wiring
- `webdav/handler.ts` – WebDAV method handlers (OPTIONS/PROPFIND/MKCOL/GET/HEAD)
- `fakefs/state.ts` – Virtual FS structures and persistence
- `fakefs/generation.ts` – Deterministic generation of listings and file content
- `llm/fs-llm.ts` – Optional LLM orchestrator (mirrors usodb-llm style)

