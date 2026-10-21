# Project Structure

- `packages/` — publishable workspaces (`cli`, `core`, `engine`, `tui`, `web-ui`).
- `scripts/` — build, release, diagnostics, and automation scripts.
- `scripts/maintenance/` — legacy one-off cleanup/rename/theme maintenance scripts.
- `docs/` — project documentation and index.
- `docs/integrations/` — integration guides for external systems.
- `docs/roadmaps/` — planning and roadmap docs.
- `docs/reports/` — historical reports and audit notes.
- `sites/` — static/marketing sites.
- `assets/` — repository-level images used by documentation.
- `themes/` — OS/theme assets that are not runtime package code.

Keep root limited to package/config/license/readme files so tooling stays predictable.
