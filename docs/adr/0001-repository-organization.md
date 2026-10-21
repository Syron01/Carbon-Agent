# ADR 0001: Repository Organization

## Status

Accepted

## Context

The project mixes publishable packages, maintenance scripts, docs, static site files, and OS theme assets. A clean layout lowers onboarding cost and reduces accidental edits during release work.

## Decision

Use these top-level boundaries:

- `packages/` for publishable workspaces
- `scripts/` for automation
- `scripts/maintenance/` for legacy one-off scripts
- `docs/` for documentation
- `docs/integrations/` for external integration guides
- `docs/roadmaps/` for planning docs
- `docs/reports/` for historical reports
- `sites/` for static sites
- `themes/` for OS/theme assets
- root only for package/config/license/readme/security files

## Consequences

- Root stays predictable for tooling.
- Runtime package code is separated from docs/assets/maintenance.
- Future folders must be added to `docs/PROJECT_STRUCTURE.md`.
