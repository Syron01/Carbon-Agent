# Security Policy

## Supported Version

Security fixes target the latest released `1.x` version.

## Reporting a Vulnerability

Do not open a public issue for secrets, auth bypasses, RCE, path traversal, token leaks, or provider credential bugs.

Report privately with:

- affected version/commit
- reproduction steps
- impact
- logs/screenshots with secrets redacted

## Security Baseline

AstroAgent must keep these rules:

- never log API keys, OAuth tokens, session secrets, or raw auth headers
- validate filesystem paths before destructive writes/deletes
- prefer least-privilege GitHub workflow permissions
- keep generated/build artifacts out of source directories
- run `npm run check` and `npm audit --omit=dev` before release
