# AstroAgent Architecture

## Workspaces

- `packages/cli` — command entrypoints, interactive mode, tools, settings, browser bridge.
- `packages/core` — provider registry, model definitions, API adapters, stream/message transforms.
- `packages/engine` — agent/session engine, MCP integration, execution loop.
- `packages/tui` — terminal rendering primitives and components.
- `packages/web-ui` — web UI surface.

## Runtime Flow

1. CLI parses args and settings.
2. Model registry resolves configured/available models.
3. Engine session builds system prompt, tools, memory/context, and provider runtime.
4. Interactive/RPC/print modes render or stream results.
5. Tools perform filesystem, shell, browser, git, search, and extension actions.

## Design Rules

- Keep provider logic in `core`; do not leak provider-specific payload rules into UI.
- Keep terminal rendering in `tui`; CLI components should compose primitives, not own raw ANSI where avoidable.
- Keep generated artifacts in `dist/`, never in `src/`.
- Prefer focused tests close to the package that owns behavior.
- Security-sensitive filesystem/network behavior must be validated at tool boundaries.
