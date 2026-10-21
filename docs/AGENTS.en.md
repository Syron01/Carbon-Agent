# AstroAgent Agent Rules

## Mode of Operation

- Language: Match user language.
- Style: Concise, serious, technical.
- Flow: inspect → act → verify.
- No fluff: provide absolute file paths, concrete results, and test suite information.
- A new project/session starts clean: do not assume context from old sessions, old requests, old files, or other projects belonging to the user.
- Refer to old session history only if `--continue`, `--resume`, `--session`, `/resume`, or direct user instruction is given.

## Code Quality

- Preserve user modifications.
- Never revert unrelated files.
- Read repo context first, then generate minimal and exact diffs.
- Large refactorings are allowed only when explicitly requested.
- Perform security checks on secrets, tokens, authentication, and file system boundaries.

## Memory & Context Isolation

- AstroAgent uses only explicitly loaded files, active session history, and the current repository context as its persistent "brain".
- A new run of `astroagent` creates a new session by default, without invoking past memories.
- If past remains are unwanted, `AstroAgent --clear-memory` purges saved session history.
- For a completely clean run, `AstroAgent --no-session --no-context-files` can be used.
- Authentication, model, and settings files are not memory; for security, `--clear-memory` does not delete them.

## Large Project / Low-Token Strategy

1. Start with `/index` or targeted `rg/find` commands.
2. Only read highly relevant files.
3. Summarize large outputs; never dump base64 or huge logs.
4. If context grows, trigger `/compact` or rely on automatic compaction.
5. Provide a short verification report upon completion.

## Browser Automation

- If a browser task is assigned, use the Chrome Browser Bridge; check `/browser` or bridge status before claiming "unable to access".
- Read state using `browser_tabs list/active` first, then inspect page using `browser_page read` or `get_elements`.
- No blind clicks: do not perform click/type actions without understanding the selector/element.
- Use `upload_file` for file pickers, and `drag` for drag/drop actions.
- Keep default output small; increase `maxChars` / `maxElements` only when needed.
- Visual overlays and labels are disabled by default; enable them only when necessary with `visual: true` or `showLabels: true`.
- Run `clear_ui` to clean up overlays once the task is finished.

## Automation Mode

Disabled by default. When enabled, AstroAgent can execute multi-step terminal/browser/app workflows. Explicit user intent and confirmation are required for high-impact external actions.

## Final Quality Gate

If code changes:

```bash
npm run check
npm test --workspace=packages/tui
npm run build
```

For security:

```bash
npm audit --omit=dev --audit-level=high
```
