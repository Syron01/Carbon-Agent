# Carbon Agent Architecture Guide

Carbon Agent is a TypeScript monorepo (npm workspaces) with a CLI, a React web UI,
and three supporting libraries.

## Packages

| Package | Name | Role |
|---------|------|------|
| `packages/core` | `astro-core` | Model providers, messages, model catalog (`models.generated.ts`), OAuth |
| `packages/engine` | `astro-engine` | Engine loop, tool execution, state management, swarm |
| `packages/tui` | `astro-tui` | Terminal UI library (differential rendering) |
| `packages/cli` | `carbon-agent-cli` | CLI entry, modes (studio/interactive/print/rpc/headless), tools |
| `packages/cli/ui` | `ui` | React + Vite web studio UI (built into `packages/cli/dist/ui`) |

## Project Structure (packages/cli)

```
packages/cli/
├── src/
│   ├── cli/             # CLI entry, args, help, dashboard
│   ├── core/            # Engine session, servers, tools, utilities
│   │   ├── web-ui-server.ts          # Auth/MCP/Brain API server (port 3131)
│   │   ├── browser-bridge-server.ts  # WebSocket bridge (port 3133-3142)
│   │   ├── engine-session.ts         # Main engine session logic
│   │   ├── compaction/               # Token/context management
│   │   ├── design-system/            # UI theme system
│   │   └── tools/                    # Tool implementations (bash, browser, ...)
│   ├── modes/
│   │   ├── studio/                   # Web UI HTTP server
│   │   │   └── studio-mode.ts        # Serves dist/ui on port 3135
│   │   ├── interactive/              # Terminal-based interactive mode
│   │   ├── print-mode.ts             # One-shot non-interactive mode
│   │   ├── rpc/                      # JSON-RPC mode
│   │   └── headless/                 # API-server-only mode
│   ├── utils/           # Utilities (version check, changelog, ...)
│   ├── config.ts        # VERSION constant, paths, settings
│   └── main.ts          # CLI entry point
├── ui/                  # React web UI source (Vite + TypeScript)
├── browser-extension/chrome/  # Chrome extension (bridge client)
└── package.json
```

## Port Map

| Port | Service | Description |
|------|---------|-------------|
| 3131 | Auth/MCP API Server | `web-ui-server.ts` - API endpoints for auth, MCP, brain |
| 3133 | Browser Bridge WebSocket | `browser-bridge-server.ts` - Browser control |
| 3135 | Web UI | `studio-mode.ts` - Serves the React build from `packages/cli/dist/ui` |
| 3133-3142 | Bridge scan range | Browser extension scans these ports for the bridge |

## Web UI System

The main user-facing web interface is the React app served by `studio-mode.ts` on **port 3135**.

**Key files:**
- `packages/cli/ui/src/` - React + TypeScript UI source (Vite project)
- `packages/cli/src/modes/studio/studio-mode.ts` - HTTP server, API routes, static asset serving
- `packages/cli/src/core/web-ui-server.ts` - Separate API server for auth, MCP, brain panels

**How it works:**
1. `studio-mode.ts` starts on port 3135 and serves the built UI from `packages/cli/dist/ui`.
2. It also starts `web-ui-server.ts` on port 3131 for auth/MCP APIs.
3. The React UI (`packages/cli/ui`) calls same-origin APIs on port 3135.
4. `studio-mode.ts` forwards MCP routes to `web-ui-server.ts`'s shared listeners.
5. Building the CLI (`npm run build`) builds the UI first via `npm --prefix ui run build`.

## MCP (Model Context Protocol)

**UI:** Access via sidebar → "MCP Manager" → modal dialog

**API endpoints:**
- `GET /api/mcp-panel` - Returns server list, connected clients, tool count
- `POST /api/mcp-panel/action` - Actions: connect, disconnect, remove, add_custom, connect_builtin

**Architecture:**
- State provider registered by `interactive-mode.ts` via `setMcpPanelStateProvider()`
- Action listeners registered by the engine via the `webUiMcpActionListeners` Set
- Both `web-ui-server.ts` (3131) and `studio-mode.ts` (3135) handle these routes
- UI state is shared via module-level exports from `web-ui-server.ts`

## Model Catalog

- Providers and models live in `packages/core`.
- `packages/core/src/models.generated.ts` is **auto-generated** — never edit it by hand.
- Regenerate against the live catalog with `npm run generate-models --workspace=packages/core`
  (source: models.dev + Vercel AI Gateway). The core build runs this automatically.
- OAuth "subscription" providers are registered in `packages/core/src/utils/oauth/index.ts`:
  Anthropic (Claude Pro/Max), GitHub Copilot, OpenAI Codex (ChatGPT), Ollama,
  Google Antigravity, GitLab Duo.

## Browser Bridge

- WebSocket server on port 3133 (fallback range 3133-3142).
- The Chrome extension connects to the bridge for browser automation.
- The extension scans the 3133-3142 range plus custom ports from storage.

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `tsc`/`concurrently` not found | Dependencies not installed — run `npm install` at the repo root |
| Version shows old value | Bump the version and rebuild (`npm run build`) |
| MCP API returns "Not Found" | Ensure `studio-mode.ts` has the MCP routes in `handleRequest` |
| Port conflict | Web UI is fixed at 3135, bridge auto-scans its range |
| Browser can't connect | Run `astro`, check the bridge port, restart the extension |
| High token usage | Append `/compact` to the session prompt |

## Roadmap (Priority Order)

1. **Sub-agent parallelization** — Worker Threads / child_process for parallel sub-agent execution
2. **`@ts-nocheck` cleanup** — Remove `@ts-nocheck` directives file-by-file, add proper types
3. **Tests** — Unit/integration tests for critical paths (sendMessage, conversation CRUD, MCP panel, todo)
4. **Polling → WebSocket/SSE** — Replace HTTP polling (todo, conversations, status) with push events
5. **State management** — Replace global `let` variables with a store pattern (zustand or a Proxy store)

## Build & Run

```bash
# From the repo root
npm install            # install workspace dependencies (once)
npm run build          # builds tui → core → engine → cli (and the React UI)

# Update the global CLI
npm install -g .

astro                  # start (opens the web UI at http://127.0.0.1:3135)
```

> `npm run dev` runs `tsc --watch` for core/engine/tui/cli concurrently via `concurrently`.
