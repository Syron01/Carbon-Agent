# Quality Gate

AstroAgent changes must pass a small-company production gate before merge/release.

## Required Checks

1. Scope is explicit: goal, acceptance criteria, touched packages.
2. Source is clean: no generated JS/d.ts/map files inside `src/`.
3. Type/lint/smoke pass: `npm run check`.
4. Focused tests pass for changed behavior.
5. Security check passes when relevant: `npm audit --omit=dev`.
6. User changes are preserved; unrelated files are not reverted.

## Release Checklist

- versions are lockstep across workspaces
- browser extension manifest version matches release version
- generated model registry is up to date when provider/model data changed
- `docs/PROJECT_STRUCTURE.md` still matches repository layout
- root directory contains only package/config/license/readme level files

## Review Standard

Approve only if the diff is smaller than the problem, easy to rollback, and verified by commands listed in the PR.
