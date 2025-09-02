# uso800fs — WebDAV Fake Filesystem

A small WebDAV server that serves a fake filesystem. If a folder/file doesn’t exist on disk (persist), it can fabricate it via LLM tool‑calls and then mirror it to disk so the next request is fast and repeatable.

## Overview
- WebDAV endpoints: OPTIONS, PROPFIND, MKCOL, GET, HEAD
- Persist adapter mirrors generated content to a directory
- Optional LLM (OpenAI Responses API) fabricates listings and file contents
- No magic: all env/CLI parsing lives in `src/index.ts`; server is pure and injected

## Prerequisites
- bun installed
- Optional: `OPENAI_API_KEY` when using LLM mode

## Install
- `bun install`

## Run
- In‑memory only (no LLM, no persist):
  - `bun run src/index.ts --port 8787`
- With persistence (mirror generated content):
  - `bun run src/index.ts --port 8787 --persist-root ./debug/fakefs`
- With LLM fabrication (when persist doesn't have the target):
  - `OPENAI_API_KEY=… bun run src/index.ts --port 8787 --persist-root ./debug/fakefs --model gpt-4.1-mini`
- Load an initial state snapshot (optional):
  - `bun run src/index.ts --port 8787 --state ./debug/fs.json`
- With interactive UI (fullscreen terminal dashboard):
  - `bun run src/index.ts --ui --port 8787 --persist-root ./debug/fakefs --model gpt-4.1-mini`

### uso800fs.config.json (optional)
Place `uso800fs.config.json` in the current directory to declaratively configure options (CLI arguments take precedence).

#### Basic Configuration Example:

```json
{
  "port": 8787,
  "persistRoot": "./data",
  "ignore": ["**/.DS_Store"],
  "ui": true,
  "llm": { 
    "model": "gpt-4o-mini", 
    "instruction": "extra prompt", 
    "apiKeyEnv": "OPENAI_API_KEY" 
  }
}
```

#### Full Configuration Example (Borgesian SF/Weird Fiction Filesystem):

```json
{
  "port": 8080,
  "persistRoot": "./persist",
  "ignore": ["node_modules", ".git", "dist", "coverage", ".env"],
  "ui": true,
  "llm": {
    "apiKeyEnv": "OPENAI_API_KEY",
    "model": "gpt-5-nano",
    "instruction": "You are the custodian of the Babel Archives...",
    "textInstruction": "Channel Borges, Lovecraft, and Philip K. Dick...",
    "imageInstruction": "Create unsettling yet mesmerizing visions..."
  },
  "image": {
    "provider": "nanobanana",
    "nanobanana": {
      "baseUrl": "https://generativelanguage.googleapis.com",
      "model": "gemini-2.0-flash-exp",
      "apiKeyEnv": "GEMINI_API_KEY"
    }
  }
}
```

#### Configuration Fields:

| Field | Description | Default |
|-------|-------------|---------|
| `port` | WebDAV server port number | 8787 |
| `persistRoot` | Directory to persist generated content | None (memory only) |
| `ignore` | Array of file/directory patterns to ignore | [] |
| `ui` | Enable interactive UI | false |
| **llm** | **LLM Configuration** | |
| `llm.apiKey` | API key (direct specification) | None |
| `llm.apiKeyEnv` | Environment variable name for API key | OPENAI_API_KEY |
| `llm.model` | Model name to use | None |
| `llm.instruction` | Base instruction (filesystem worldbuilding) | Default playful instruction |
| `llm.textInstruction` | Special instruction for text file generation | None |
| `llm.imageInstruction` | Special instruction for image generation | None |
| **image** | **Image Generation Provider Configuration** | |
| `image.provider` | Provider type ("openai" or "nanobanana") | None |
| `image.openai.*` | OpenAI DALL-E configuration | |
| `image.nanobanana.*` | Google Gemini image generation configuration | |

#### Customizing LLM Instructions:

Use `textInstruction` and `imageInstruction` to fine-tune the style of generated content:

- **`instruction`**: Overall filesystem worldbuilding and setting (e.g., "Custodian of the Babel Archives")
- **`textInstruction`**: Text file content style (e.g., "Borgesian fragments of impossible encyclopedias")
- **`imageInstruction`**: Visual style for images (e.g., "Non-Euclidean architecture in dark academia style")

#### Precedence:
- CLI arguments > config file > environment variables
- Config file is automatically loaded from the current directory

## Options
- `--port <number>`: HTTP port (required)
- `--state <path>`: Load initial FS snapshot (JSON)
- `--persist-root <dir>`: Persist directory for mirroring generated content
- `--model <name>`: OpenAI model for LLM tool‑calls (requires `OPENAI_API_KEY`)
- `--instruction <text>`: Extra text appended to the built‑in "silly" instruction
- `--ui`: Enable interactive terminal UI with real-time monitoring

## Interactive UI Mode

The `--ui` flag enables a fullscreen terminal dashboard for real-time monitoring:

- **WebDAV I/O Panel**: Tracks all incoming HTTP requests and outgoing responses
- **LLM Sessions Panel**: Shows LLM invocations with details:
  - START/END events with → and ← indicators
  - Generated directories and files (📁 and 📄 icons)
  - File sizes and item counts
- **Stats Bar**: Real-time metrics for requests, responses, and LLM calls
- **Fullscreen Mode**: Uses alternate screen buffer (exits cleanly with Ctrl+C)

Example:
```bash
# Start with UI monitoring
bun run src/cli.ts --ui --port 8787 --persist-root ./debug/fakefs --model gpt-4o-mini

# The UI will show:
# - All WebDAV operations (GET, PUT, PROPFIND, etc.)
# - LLM generations with created files/folders
# - Real-time statistics
```

## Behavior
- PROPFIND/GET
  1) If target exists in persist → load into memory → respond
  2) Else if LLM configured → fabricate → write to persist → respond
  3) Else → 404
- MKCOL
  - Create directory in memory, then (if LLM configured) fabricate a listing and sync to persist

## Quick WebDAV Checks
- List root (PROPFIND):
  - `curl -i -X PROPFIND -H "Depth: 1" http://127.0.0.1:8787/`
- Make folder:
  - `curl -i -X MKCOL http://127.0.0.1:8787/AI/`
- Get file (fabricates when missing):
  - `curl -i http://127.0.0.1:8787/AI/hello.txt`

## Development
- Lint / Typecheck / Tests:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run test`

## Structure
- `src/index.ts` — CLI/env parse, dependency injection, app creation
- `src/server.ts` — Hono WebDAV app factory (no env read), per‑app injected deps
- `src/hono-middleware-webdav/handler.ts` — WebDAV method handlers
- `src/fakefs/*` — In‑memory FS and deterministic content generation
- `src/llm/fs-llm.ts` — OpenAI Responses API orchestration (tool‑calls only)
