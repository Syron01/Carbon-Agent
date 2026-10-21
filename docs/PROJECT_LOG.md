# AstroAgent Project Log

## Final hardening pass

### Added

- AstroAgent branding and GitHub repository publication.
- `astroagent` primary CLI command with `astrocli` backward-compatible alias.
- `/automation on|off|confirm on|confirm off` mode.
- Browser Bridge `drag`, `upload_file`, `clear_ui`, low-token `read/read_dom`, optional labels/overlay.
- Browser auto-launch attempt when bridge has no connected extension.
- Competitive roadmap based on Claude Code, Cursor, Windsurf and Codex CLI feature expectations.
- GitHub self-update fallback: `AstroAgent update` / `astrocli update` can clone AstroAgent from GitHub and reinstall globally when package-manager self-update is unavailable.

### Changed

- TUI layout moved to focused single-column flow.
- Footer simplified and now shows `automation` when active.
- Default Smoot theme replaced with AstroAgent's soft red/amber premium palette.
- README and docs updated for production use.

### Fixed / Hardened

- Browser extension rejects browser-internal pages and unrelated extension pages.
- Debugger attach/detach is centralized to reduce leaked debugger sessions.
- Browser output truncation avoids huge base64/token payloads.
- TUI symlink tests skip cleanly on Windows without symlink privilege.

### Validation

- `npm run check`
- `npm test --workspace=packages/tui`
- `npm run build`
- `npm audit --omit=dev --audit-level=high`
